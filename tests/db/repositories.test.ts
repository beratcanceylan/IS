import { getSchemaVersion, LATEST_VERSION, runMigrations, type Migration } from '@/db/migrations';
import {
  applyLifecycleRules,
  countFeed,
  getDuplicateMembers,
  getJob,
  markMissingAsPossiblyRemoved,
  purgeOldJobs,
  queryFeed,
  upsertJob,
} from '@/db/repositories/jobs-repository';
import { addFavorite, getPersonalState, hideJob, listSaved, setNote, setStatus } from '@/db/repositories/personal-repository';
import { getSetting, setSetting } from '@/db/repositories/settings-repository';
import type { JobFilter } from '@/domain/saved-search';

import { makeJob } from '../helpers/fixtures';
import { createMigratedDb, createNodeDb } from '../helpers/node-db';

const NOW = '2026-09-25T09:00:00.000Z';
const EPOCH = '1970-01-01T00:00:00.000Z';
const sql = { ftsAvailable: true, now: new Date(NOW) };

async function feed(db: Awaited<ReturnType<typeof createMigratedDb>>, filter: JobFilter = {}) {
  const page = await queryFeed(db, { filter, newSince: EPOCH, sql, limit: 100 });
  return page.items;
}

describe('migrations', () => {
  it('boş DB en son sürüme çıkar ve tekrar çalıştırmak bir şey yapmaz', async () => {
    const db = createNodeDb();
    expect(await runMigrations(db)).toEqual([1, 2]);
    expect(await getSchemaVersion(db)).toBe(LATEST_VERSION);
    expect(await runMigrations(db)).toEqual([]);
    expect(await getSetting(db, 'ftsAvailable')).toBe(true);
  });

  it('hatalı migration geri alınır, önceki veri korunur', async () => {
    const db = await createMigratedDb();
    await upsertJob(db, makeJob({ title: 'Korunacak' }), { now: NOW, baseline: false });
    const broken: Migration = {
      version: LATEST_VERSION + 1,
      name: 'broken',
      async up(tx) {
        await tx.execAsync('CREATE TABLE temp_x (id INTEGER)');
        throw new Error('boom');
      },
    };
    await expect(runMigrations(db, [broken])).rejects.toThrow('boom');
    expect(await getSchemaVersion(db)).toBe(LATEST_VERSION);
    expect(await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE name = 'temp_x'`)).toBeNull();
    expect((await feed(db)).map((j) => j.title)).toEqual(['Korunacak']);
  });
});

describe('upsertJob', () => {
  it('aynı kaynak + external id tekrar eklenmez, güncellenir', async () => {
    const db = await createMigratedDb();
    const job = makeJob({ sourceExternalId: 'x1', title: 'Büro Personeli' });
    const a = await upsertJob(db, job, { now: NOW, baseline: false });
    const b = await upsertJob(db, { ...job, title: 'Büro Personeli (güncel)' }, { now: NOW, baseline: false });
    expect(a.inserted).toBe(true);
    expect(b).toMatchObject({ id: a.id, inserted: false, changed: true });
    expect(await countFeed(db, {}, sql)).toBe(1);
  });

  it('boş gelen alan, önceden bilinen değeri silmez', async () => {
    const db = await createMigratedDb();
    const job = makeJob({ sourceExternalId: 'x2', description: 'Detaydan gelen metin', kpssRequired: true });
    const { id } = await upsertJob(db, job, { now: NOW, baseline: false });
    await upsertJob(db, { ...job, description: null, kpssRequired: null }, { now: NOW, baseline: false });
    const saved = await getJob(db, id);
    expect(saved?.description).toBe('Detaydan gelen metin');
    expect(saved?.kpssRequired).toBe(true);
  });
});

describe('yaşam döngüsü', () => {
  it('görünmeyen ilan silinmez, possiblyRemoved olur; süresi geçen expired olur', async () => {
    const db = await createMigratedDb();
    const old = await upsertJob(db, makeJob({ title: 'Eski' }), { now: '2026-09-20T09:00:00.000Z', baseline: false });
    const expired = await upsertJob(db, makeJob({ applicationDeadline: '2026-09-24T20:59:59.000Z' }), {
      now: NOW,
      baseline: false,
    });
    await markMissingAsPossiblyRemoved(db, 'test-source', '2026-09-25T08:00:00.000Z');
    await applyLifecycleRules(db, new Date(NOW));
    expect((await getJob(db, old.id))?.lifecycle).toBe('possiblyRemoved');
    expect((await getJob(db, expired.id))?.lifecycle).toBe('expired');
    // possiblyRemoved akışta görünmeye devam eder; expired görünmez.
    expect((await feed(db)).map((j) => j.id)).toEqual([old.id]);
  });

  it('favori ilan arşivlenmez ve temizlikte silinmez', async () => {
    const db = await createMigratedDb();
    const fav = await upsertJob(db, makeJob(), { now: '2026-01-01T00:00:00.000Z', baseline: false });
    const plain = await upsertJob(db, makeJob(), { now: '2026-01-01T00:00:00.000Z', baseline: false });
    await addFavorite(db, fav.id, NOW);
    await markMissingAsPossiblyRemoved(db, 'test-source', NOW);
    await applyLifecycleRules(db, new Date(NOW));
    expect((await getJob(db, fav.id))?.lifecycle).toBe('possiblyRemoved');
    expect((await getJob(db, plain.id))?.lifecycle).toBe('archived');
    const purged = await purgeOldJobs(db, 30, new Date(NOW));
    expect(purged).toBe(1);
    expect(await getJob(db, fav.id)).not.toBeNull();
    expect(await getJob(db, plain.id)).toBeNull();
  });
});

describe('queryFeed filtreleri', () => {
  async function seed() {
    const db = await createMigratedDb();
    const add = (o: Parameters<typeof makeJob>[0]) => upsertJob(db, makeJob(o), { now: NOW, baseline: false });
    const ids = {
      tekirdagKpsssiz: (await add({ title: 'Büro Personeli', city: 'Tekirdağ', district: 'Çorlu', kpssRequired: false, educationLevels: ['highSchool'] })).id,
      tekirdagP3: (await add({ title: 'Bilgi İşlem Personeli', city: 'Tekirdağ', kpssRequired: true, kpssScoreTypes: ['P3'], kpssMinimumScore: 75, educationLevels: ['bachelor'] })).id,
      istanbulPrivate: (await add({ title: 'Satış Temsilcisi', sector: 'private', city: 'İstanbul', workModel: 'hybrid' })).id,
      unknownCity: (await add({ title: 'Kurye', organization: 'Karayolları Genel Müdürlüğü', city: null })).id,
    };
    return { db, ids };
  }

  it('il filtresi, konumu bilinmeyenleri strict değilse dahil eder', async () => {
    const { db, ids } = await seed();
    const f: JobFilter = { locations: [{ plate: 59 }] };
    expect((await feed(db, f)).map((j) => j.id).sort()).toEqual([ids.tekirdagKpsssiz, ids.tekirdagP3, ids.unknownCity].sort());
    expect((await feed(db, { ...f, strict: true })).map((j) => j.id).sort()).toEqual([ids.tekirdagKpsssiz, ids.tekirdagP3].sort());
  });

  it('ilçe filtresi', async () => {
    const { db, ids } = await seed();
    const items = await feed(db, { locations: [{ plate: 59, districts: ['Çorlu'] }], strict: true });
    expect(items.map((j) => j.id)).toEqual([ids.tekirdagKpsssiz]);
  });

  it('KPSS istemeyen + sektör', async () => {
    const { db, ids } = await seed();
    const items = await feed(db, { kpss: 'notRequired', sector: 'public', strict: true });
    expect(items.map((j) => j.id)).toEqual([ids.tekirdagKpsssiz]);
  });

  it('KPSS puanım minimumun altındaysa elenir', async () => {
    const { db, ids } = await seed();
    const low = await feed(db, { kpssMyScore: 70 });
    expect(low.map((j) => j.id)).not.toContain(ids.tekirdagP3);
    const high = await feed(db, { kpssMyScore: 80 });
    expect(high.map((j) => j.id)).toContain(ids.tekirdagP3);
  });

  it('eğitim filtresi', async () => {
    const { db, ids } = await seed();
    expect((await feed(db, { educationLevels: ['bachelor'], strict: true })).map((j) => j.id)).toEqual([ids.tekirdagP3]);
  });

  it('hariç tutulan kelimeler başlıkta aranır, Türkçe karakter duyarlı/katlamalı', async () => {
    const { db, ids } = await seed();
    const a = await feed(db, { excludeKeywords: ['satış', 'kurye'] });
    expect(a.map((j) => j.id).sort()).toEqual([ids.tekirdagKpsssiz, ids.tekirdagP3].sort());
    const b = await feed(db, { excludeKeywords: ['satis'] });
    expect(b.map((j) => j.id)).not.toContain(ids.istanbulPrivate);
  });

  it('serbest metin: "BİLGİ İŞLEM" ve "bilgi islem" aynı ilanı bulur (FTS ve LIKE)', async () => {
    const { db, ids } = await seed();
    for (const ftsAvailable of [true, false]) {
      for (const query of ['BİLGİ İŞLEM', 'bilgi islem', 'bilgi']) {
        const page = await queryFeed(db, { filter: { query }, newSince: EPOCH, sql: { ...sql, ftsAvailable } });
        expect(page.items.map((j) => j.id)).toEqual([ids.tekirdagP3]);
      }
    }
  });

  it('gizlenen ilan akışta görünmez', async () => {
    const { db, ids } = await seed();
    await hideJob(db, ids.istanbulPrivate, NOW);
    expect((await feed(db)).map((j) => j.id)).not.toContain(ids.istanbulPrivate);
  });

  it('keyset sayfalama tüm ilanları bir kez döndürür', async () => {
    const db = await createMigratedDb();
    for (let i = 0; i < 25; i++) {
      await upsertJob(db, makeJob({ publishedAt: `2026-09-${String((i % 20) + 1).padStart(2, '0')}T08:00:00.000Z` }), {
        now: NOW,
        baseline: i < 10,
      });
    }
    const seen: number[] = [];
    let cursor = null;
    do {
      const page = await queryFeed(db, { filter: {}, newSince: EPOCH, sql, cursor, limit: 7 });
      seen.push(...page.items.map((j) => j.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25);
    // Baseline olmayanlar (yeni) önce gelir.
    const first = await queryFeed(db, { filter: {}, newSince: EPOCH, sql, limit: 15 });
    expect(first.items.slice(0, 15).every((j) => j.isNew)).toBe(true);
  });
});

describe('deduplication (DB)', () => {
  it('kaynaklar arası aynı ilan gruplanır, akışta bir kez görünür', async () => {
    const db = await createMigratedDb();
    const a = await upsertJob(
      db,
      makeJob({
        sourceId: 'kariyer-kapisi',
        title: 'KARAYOLLARI GENEL MÜDÜRLÜĞÜ - 50 İŞÇİ ALIMI',
        organization: 'KARAYOLLARI GENEL MÜDÜRLÜĞÜ',
        quota: 50,
        applicationDeadline: '2026-09-25T14:30:00.000Z',
      }),
      { now: NOW, baseline: false },
    );
    const b = await upsertJob(
      db,
      makeJob({
        sourceId: 'kamuilan-sbb',
        title: '50 İŞÇİ ALACAK',
        organization: 'Karayolları Genel Müdürlüğü',
        quota: 50,
        applicationDeadline: '2026-09-25T20:59:59.000Z',
      }),
      { now: NOW, baseline: false },
    );
    const items = await feed(db);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: a.id, duplicateCount: 1 });
    const job = await getJob(db, a.id);
    expect((await getDuplicateMembers(db, job!)).map((m) => m.id)).toEqual([b.id]);
  });

  it('aynı kurumun farklı ilanları birleştirilmez', async () => {
    const db = await createMigratedDb();
    await upsertJob(
      db,
      makeJob({ sourceId: 'a', title: '3 ÖĞRETİM ÜYESİ ALACAK', organization: 'Kocaeli Üniversitesi', applicationDeadline: '2026-10-08T20:59:59.000Z' }),
      { now: NOW, baseline: false },
    );
    await upsertJob(
      db,
      makeJob({ sourceId: 'b', title: '25 ÖĞRETİM ÜYESİ ALACAK', organization: 'Kocaeli Üniversitesi', applicationDeadline: '2026-10-08T20:59:59.000Z' }),
      { now: NOW, baseline: false },
    );
    await upsertJob(
      db,
      makeJob({ sourceId: 'c', title: '3 ÖĞRETİM ÜYESİ ALACAK', organization: 'Kocaeli Üniversitesi', applicationDeadline: '2026-11-20T20:59:59.000Z' }),
      { now: NOW, baseline: false },
    );
    expect(await feed(db)).toHaveLength(3);
  });
});

describe('kişisel veri', () => {
  it('durum, başvuru tarihi, not ve kaydedilenler', async () => {
    const db = await createMigratedDb();
    const { id } = await upsertJob(db, makeJob(), { now: NOW, baseline: false });
    await setStatus(db, id, 'toReview', NOW);
    expect((await getPersonalState(db, id)).appliedAt).toBeNull();
    await setStatus(db, id, 'applied', '2026-09-26T10:00:00.000Z');
    await setStatus(db, id, 'interview', '2026-10-01T10:00:00.000Z');
    await setNote(db, id, '  CV güncelle  ', NOW);
    await addFavorite(db, id, NOW);
    const state = await getPersonalState(db, id);
    expect(state).toMatchObject({ status: 'interview', appliedAt: '2026-09-26T10:00:00.000Z', note: 'CV güncelle', isFavorite: true });
    expect((await listSaved(db, 'favorites')).map((j) => j.id)).toEqual([id]);
    expect((await listSaved(db, 'applications'))[0].personalStatus).toBe('interview');
  });

  it('ayarlar JSON olarak saklanır', async () => {
    const db = await createMigratedDb();
    expect(await getSetting(db, 'syncIntervalMinutes')).toBe(180);
    await setSetting(db, 'feedFilter', { locations: [{ plate: 59 }] });
    expect(await getSetting(db, 'feedFilter')).toEqual({ locations: [{ plate: 59 }] });
  });
});
