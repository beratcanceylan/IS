import { getJob } from '@/db/repositories/jobs-repository';
import { getHealth } from '@/db/repositories/sources-repository';
import type { NormalizedJob } from '@/domain/job';
import type { ListingResult, SyncSourceAdapter } from '@/sources/types';
import { backoffMs, detectAnomaly, runSync } from '@/sync/sync-engine';
import { HttpClient, HttpError } from '@/utils/network';

import { makeJob } from '../helpers/fixtures';
import { createMigratedDb } from '../helpers/node-db';

let clock = new Date('2026-09-25T09:00:00.000Z');
const now = () => clock;
const advance = (minutes: number) => {
  clock = new Date(clock.getTime() + minutes * 60_000);
};

function fakeAdapter(id: string, impl: () => Promise<ListingResult> | ListingResult, extra: Partial<SyncSourceAdapter> = {}): SyncSourceAdapter {
  return {
    id,
    displayName: id,
    kind: 'official',
    mode: 'RSS_OR_FEED',
    homepageUrl: 'https://example.gov.tr',
    description: '',
    defaultEnabled: true,
    minIntervalMinutes: 60,
    requestDelayMs: 0,
    parserVersion: 1,
    expectedMinCount: 1,
    fetchListings: async () => impl(),
    ...extra,
  };
}

const ok = (jobs: NormalizedJob[]): ListingResult => ({ notModified: false, jobs, complete: true, httpStatus: 200, etag: null, lastModified: null });
const http = () => new HttpClient({ minDelayMs: 0, sleep: async () => undefined });

beforeEach(() => {
  clock = new Date('2026-09-25T09:00:00.000Z');
});

describe('runSync', () => {
  it('ilk senkron baseline sayılır (yeni değil), sonraki yeni ilanlar yeni sayılır', async () => {
    const db = await createMigratedDb();
    let jobs = [makeJob({ sourceId: 'a', sourceExternalId: '1' }), makeJob({ sourceId: 'a', sourceExternalId: '2' })];
    const adapter = fakeAdapter('a', () => ok(jobs));
    const first = await runSync(db, { trigger: 'manual', sources: [adapter], now, httpFactory: http });
    expect(first.sources[0].insertedIds).toHaveLength(2);
    expect(first.newJobIds).toEqual([]);

    advance(61);
    jobs = [...jobs, makeJob({ sourceId: 'a', sourceExternalId: '3' })];
    const second = await runSync(db, { trigger: 'manual', sources: [adapter], now, httpFactory: http });
    expect(second.newJobIds).toHaveLength(1);
  });

  it('cooldown süresi dolmadan kaynağa istek atmaz; force ile atar', async () => {
    const db = await createMigratedDb();
    const fetchListings = jest.fn(async () => ok([makeJob({ sourceId: 'a' })]));
    const adapter = fakeAdapter('a', fetchListings);
    await runSync(db, { trigger: 'foreground', sources: [adapter], now, httpFactory: http });
    advance(10);
    const r = await runSync(db, { trigger: 'foreground', sources: [adapter], now, httpFactory: http });
    expect(r.sources[0]).toMatchObject({ outcome: 'skipped', skippedReason: 'cooldown' });
    await runSync(db, { trigger: 'manual', force: true, sources: [adapter], now, httpFactory: http });
    expect(fetchListings).toHaveBeenCalledTimes(2);
  });

  it('bir kaynağın hatası diğerini etkilemez; 403 kaynağı 24 saat dinlendirir (force dahil)', async () => {
    const db = await createMigratedDb();
    const blocked = fakeAdapter('blocked', () => {
      throw new HttpError('blocked', 'Erişim reddedildi (HTTP 403)', 403);
    });
    const good = fakeAdapter('good', () => ok([makeJob({ sourceId: 'good' })]));
    const r = await runSync(db, { trigger: 'manual', sources: [blocked, good], now, httpFactory: http });
    expect(r.sources.find((s) => s.sourceId === 'good')?.outcome).toBe('ok');
    const health = await getHealth(db, 'blocked');
    expect(health).toMatchObject({ status: 'blocked', lastHttpStatus: 403, consecutiveFailures: 1 });

    advance(60);
    const again = await runSync(db, { trigger: 'manual', force: true, sources: [blocked], now, httpFactory: http });
    expect(again.sources[0]).toMatchObject({ outcome: 'skipped', skippedReason: 'backoff' });
  });

  it('parser hatası kaydedilir ve backoff uygulanır', async () => {
    const db = await createMigratedDb();
    const broken = fakeAdapter('broken', () => {
      throw new Error('Zaman çizelgesi bulunamadı');
    });
    await runSync(db, { trigger: 'manual', sources: [broken], now, httpFactory: http });
    const h = await getHealth(db, 'broken');
    expect(h.status).toBe('failing');
    expect(h.warning).toBe('Parser kontrol edilmeli');
    expect(h.lastError).toContain('Zaman çizelgesi');
    expect(Date.parse(h.nextAllowedAt!)).toBe(clock.getTime() + 10 * 60_000);
  });

  it('842 → 0 anomalisi başarı sayılmaz ve mevcut ilanları kaldırmaz', async () => {
    const db = await createMigratedDb();
    let jobs = Array.from({ length: 30 }, (_, i) => makeJob({ sourceId: 'a', sourceExternalId: `j${i}` }));
    const adapter = fakeAdapter('a', () => ok(jobs), { expectedMinCount: 10 });
    const first = await runSync(db, { trigger: 'manual', sources: [adapter], now, httpFactory: http });
    const someId = first.sources[0].insertedIds[0];

    advance(61);
    jobs = [];
    await runSync(db, { trigger: 'manual', sources: [adapter], now, httpFactory: http });
    const h = await getHealth(db, 'a');
    expect(h.status).toBe('degraded');
    expect(h.warning).toContain('önceki: 30');
    expect((await getJob(db, someId))?.lifecycle).toBe('active');
  });

  it('tam listede görünmeyen ilan possiblyRemoved olur, silinmez', async () => {
    const db = await createMigratedDb();
    let jobs = [makeJob({ sourceId: 'a', sourceExternalId: 'keep' }), makeJob({ sourceId: 'a', sourceExternalId: 'gone' })];
    const adapter = fakeAdapter('a', () => ok(jobs));
    const r = await runSync(db, { trigger: 'manual', sources: [adapter], now, httpFactory: http });
    const [, goneId] = r.sources[0].insertedIds;
    advance(61);
    jobs = [jobs[0]];
    await runSync(db, { trigger: 'manual', sources: [adapter], now, httpFactory: http });
    expect((await getJob(db, goneId))?.lifecycle).toBe('possiblyRemoved');
  });

  it('detayları bütçe dahilinde çeker ve metinden alan çıkarır', async () => {
    const db = await createMigratedDb();
    const adapter = fakeAdapter('a', () => ok([makeJob({ sourceId: 'a', sourceExternalId: 'd1', title: 'Büro Personeli' })]), {
      detailBudget: 5,
      fetchDetails: async (_ctx, target) =>
        makeJob({
          sourceId: 'a',
          sourceExternalId: target.sourceExternalId,
          title: 'Büro Personeli',
          description: 'Lisans mezunu olmak, KPSS P3 puan türünden en az 70 puan almış olmak.',
        }),
    });
    const r = await runSync(db, { trigger: 'manual', sources: [adapter], now, httpFactory: http });
    expect(r.sources[0].detailsFetched).toBe(1);
    const job = await getJob(db, r.sources[0].insertedIds[0]);
    expect(job).toMatchObject({ kpssRequired: true, kpssMinimumScore: 70, educationLevels: ['bachelor'] });
    expect(job?.detailFetchedAt).not.toBeNull();
  });
});

describe('yardımcılar', () => {
  it('anomali tespiti', () => {
    expect(detectAnomaly(842, 0, 10)).toContain('önceki: 842');
    expect(detectAnomaly(null, 0, 10)).toContain('hiç ilan');
    expect(detectAnomaly(100, 10, 10)).toContain('olağandışı');
    expect(detectAnomaly(100, 90, 10)).toBeNull();
    expect(detectAnomaly(5, 0, 0)).toBeNull();
  });

  it('backoff 10 dakikadan başlar, 12 saatle sınırlıdır', () => {
    expect(backoffMs(1)).toBe(10 * 60_000);
    expect(backoffMs(2)).toBe(20 * 60_000);
    expect(backoffMs(20)).toBe(12 * 60 * 60_000);
  });
});
