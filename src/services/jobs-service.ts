import { getDb } from '@/db/database';
import * as jobs from '@/db/repositories/jobs-repository';
import * as personal from '@/db/repositories/personal-repository';
import { getSetting } from '@/db/repositories/settings-repository';
import type { PersonalStatus } from '@/domain/job';
import type { JobFilter } from '@/domain/saved-search';
import type { FilterSqlOptions } from '@/search/filter-sql';
import { sourceIdsByKind } from '@/sources/registry';
import { nowIso } from '@/utils/dates';

/**
 * Ekranların kullandığı veri servisi. SQL ve registry ayrıntılarını ekranlardan saklar.
 */

let ftsCache: boolean | null = null;

async function sqlOptions(): Promise<FilterSqlOptions> {
  const db = await getDb();
  ftsCache ??= (await getSetting(db, 'ftsAvailable')) !== false;
  return { ftsAvailable: ftsCache, sourceIdsByKind: sourceIdsByKind(), now: new Date() };
}

export async function fetchFeedPage(filter: JobFilter, newSince: string, cursor: jobs.FeedCursor | null) {
  const db = await getDb();
  return jobs.queryFeed(db, { filter, newSince, cursor, limit: 40, sql: await sqlOptions() });
}

export async function fetchFeedCount(filter: JobFilter): Promise<number> {
  return jobs.countFeed(await getDb(), filter, await sqlOptions());
}

export async function fetchNewCount(filter: JobFilter, newSince: string): Promise<number> {
  return jobs.countNew(await getDb(), filter, newSince, await sqlOptions());
}

export async function fetchJobDetail(id: number) {
  const db = await getDb();
  const job = await jobs.getJob(db, id);
  if (!job) return null;
  const [duplicates, state] = await Promise.all([jobs.getDuplicateMembers(db, job), personal.getPersonalState(db, id)]);
  return { job, duplicates, personal: state };
}

export type JobDetail = NonNullable<Awaited<ReturnType<typeof fetchJobDetail>>>;

export async function markViewed(id: number) {
  await jobs.markViewed(await getDb(), id, nowIso());
}

export async function toggleFavorite(id: number, favorite: boolean) {
  await personal.setFavorite(await getDb(), id, favorite, nowIso());
}

export async function setHidden(id: number, hidden: boolean) {
  await personal.setHidden(await getDb(), id, hidden, nowIso());
}

export async function setStatus(id: number, status: PersonalStatus | null) {
  await personal.setStatus(await getDb(), id, status, nowIso());
}

export async function setNote(id: number, body: string) {
  await personal.setNote(await getDb(), id, body, nowIso());
}

export async function fetchSaved(kind: personal.SavedListKind) {
  return personal.listSaved(await getDb(), kind);
}
