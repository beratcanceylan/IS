import type { JobListItem, PersonalStatus } from '@/domain/job';
import type { Db } from '@/db/types';

import { JOB_LIST_COLUMNS, rowToListItem, type JobListRow } from './job-rows';

/** Favori, gizleme, başvuru durumu, not ve hatırlatıcılar. Hepsi yalnızca cihazda. */

export async function addFavorite(db: Db, jobId: number, now: string): Promise<void> {
  await db.runAsync('INSERT OR IGNORE INTO favorites (job_id, created_at) VALUES (?, ?)', [jobId, now]);
}

export async function removeFavorite(db: Db, jobId: number): Promise<void> {
  await db.runAsync('DELETE FROM favorites WHERE job_id = ?', [jobId]);
}

export async function hideJob(db: Db, jobId: number, now: string): Promise<void> {
  await db.runAsync('INSERT OR IGNORE INTO hidden_jobs (job_id, created_at) VALUES (?, ?)', [jobId, now]);
}

export async function unhideJob(db: Db, jobId: number): Promise<void> {
  await db.runAsync('DELETE FROM hidden_jobs WHERE job_id = ?', [jobId]);
}

export interface PersonalState {
  isFavorite: boolean;
  isHidden: boolean;
  status: PersonalStatus | null;
  appliedAt: string | null;
  note: string | null;
  reminderDays: number[];
}

export async function getPersonalState(db: Db, jobId: number): Promise<PersonalState> {
  const row = await db.getFirstAsync<{
    fav: number;
    hidden: number;
    status: string | null;
    applied_at: string | null;
    note: string | null;
  }>(
    `SELECT
       EXISTS (SELECT 1 FROM favorites WHERE job_id = ?1) AS fav,
       EXISTS (SELECT 1 FROM hidden_jobs WHERE job_id = ?1) AS hidden,
       (SELECT status FROM application_status WHERE job_id = ?1) AS status,
       (SELECT applied_at FROM application_status WHERE job_id = ?1) AS applied_at,
       (SELECT body FROM job_notes WHERE job_id = ?1) AS note`,
    [jobId],
  );
  const reminders = await db.getAllAsync<{ days_before: number }>(
    'SELECT days_before FROM reminders WHERE job_id = ? ORDER BY days_before',
    [jobId],
  );
  return {
    isFavorite: row?.fav === 1,
    isHidden: row?.hidden === 1,
    status: (row?.status ?? null) as PersonalStatus | null,
    appliedAt: row?.applied_at ?? null,
    note: row?.note ?? null,
    reminderDays: reminders.map((r) => r.days_before),
  };
}

/** Başvuru durumları: "Başvurdum" ve sonrası seçildiğinde başvuru tarihi bir kez otomatik kaydedilir. */
const APPLIED_STATES: Set<PersonalStatus> = new Set(['applied', 'interview', 'waiting', 'rejected', 'offer']);

export async function setStatus(db: Db, jobId: number, status: PersonalStatus | null, now: string): Promise<void> {
  if (status === null) {
    await db.runAsync('DELETE FROM application_status WHERE job_id = ?', [jobId]);
    return;
  }
  const appliedAt = APPLIED_STATES.has(status) ? now : null;
  await db.runAsync(
    `INSERT INTO application_status (job_id, status, applied_at, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (job_id) DO UPDATE SET
       status = excluded.status,
       applied_at = COALESCE(application_status.applied_at, excluded.applied_at),
       updated_at = excluded.updated_at`,
    [jobId, status, appliedAt, now],
  );
}

export async function setNote(db: Db, jobId: number, body: string, now: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) {
    await db.runAsync('DELETE FROM job_notes WHERE job_id = ?', [jobId]);
    return;
  }
  await db.runAsync(
    `INSERT INTO job_notes (job_id, body, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (job_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
    [jobId, trimmed, now],
  );
}

export interface ReminderRow {
  id: number;
  jobId: number;
  daysBefore: number;
  notifyAt: string;
  notificationId: string | null;
}

export async function upsertReminder(
  db: Db,
  r: { jobId: number; daysBefore: number; notifyAt: string; notificationId: string | null },
  now: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO reminders (job_id, days_before, notify_at, notification_id, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (job_id, days_before) DO UPDATE SET notify_at = excluded.notify_at, notification_id = excluded.notification_id`,
    [r.jobId, r.daysBefore, r.notifyAt, r.notificationId, now],
  );
}

export async function getReminder(db: Db, jobId: number, daysBefore: number): Promise<ReminderRow | null> {
  const row = await db.getFirstAsync<{ id: number; job_id: number; days_before: number; notify_at: string; notification_id: string | null }>(
    'SELECT * FROM reminders WHERE job_id = ? AND days_before = ?',
    [jobId, daysBefore],
  );
  return row
    ? { id: row.id, jobId: row.job_id, daysBefore: row.days_before, notifyAt: row.notify_at, notificationId: row.notification_id }
    : null;
}

export async function deleteReminder(db: Db, jobId: number, daysBefore: number): Promise<void> {
  await db.runAsync('DELETE FROM reminders WHERE job_id = ? AND days_before = ?', [jobId, daysBefore]);
}

export type SavedListKind = 'favorites' | 'applications' | 'hidden';

/** Kaydedilenler ekranı. Yaşam döngüsünden bağımsız: süresi dolmuş favoriler de görünür. */
export async function listSaved(db: Db, kind: SavedListKind): Promise<JobListItem[]> {
  const join = {
    favorites: 'JOIN favorites x ON x.job_id = j.id',
    applications: 'JOIN application_status x ON x.job_id = j.id',
    hidden: 'JOIN hidden_jobs x ON x.job_id = j.id',
  }[kind];
  const order = kind === 'applications' ? 'x.updated_at DESC' : 'x.created_at DESC';
  const rows = await db.getAllAsync<JobListRow>(`SELECT ${JOB_LIST_COLUMNS}, 0 AS is_new FROM jobs j ${join} ORDER BY ${order}`);
  return rows.map(rowToListItem);
}
