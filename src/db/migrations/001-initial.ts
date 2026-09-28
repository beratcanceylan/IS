import type { Migration } from './index';

/**
 * İlk şema.
 *
 * Tasarım notları:
 * - `jobs` her satırı bir kaynaktaki bir ilandır. Aynı ilanın farklı kaynaklardaki kopyaları
 *   `duplicate_group_id` ile gruplanır; grup kimliği gruptaki ilk (birincil) ilanın id'sidir.
 *   Ayrı bir `job_sources` tablosuna gerek kalmaz.
 * - Çok değerli alanlar (`education_levels`, `kpss_score_types`) ",lisans,önlisans," gibi
 *   iki ucu virgüllü metin olarak saklanır; `LIKE '%,bachelor,%'` ile indekssiz ama hızlı aranır.
 * - Kişisel veriler (favori, not, durum) `jobs.id`'ye bağlıdır. Bu tablolarda kaydı olan ilan
 *   yaşam döngüsü ne olursa olsun otomatik silinmez.
 * - `baseline = 1`: kaynağın ilk başarılı senkronunda gelen ilan. Bunlar "yeni" sayılmaz ve
 *   bildirim üretmez; aksi halde ilk kurulumda yüzlerce "yeni ilan" görünürdü.
 */
export const migration001: Migration = {
  version: 1,
  name: 'initial',
  async up(db) {
    await db.execAsync(`
      CREATE TABLE sources (
        id TEXT PRIMARY KEY NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        config_json TEXT
      );

      CREATE TABLE source_health (
        source_id TEXT PRIMARY KEY NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        last_attempt_at TEXT,
        last_success_at TEXT,
        last_http_status INTEGER,
        last_error TEXT,
        last_parsed_count INTEGER,
        last_new_count INTEGER,
        last_duration_ms INTEGER,
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        warning TEXT,
        etag TEXT,
        last_modified TEXT,
        parser_version INTEGER,
        next_allowed_at TEXT
      );

      CREATE TABLE jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT NOT NULL,
        source_external_id TEXT NOT NULL,
        source_url TEXT NOT NULL,
        canonical_url TEXT,

        title TEXT NOT NULL,
        organization TEXT,
        organization_norm TEXT,
        department TEXT,
        profession TEXT,

        sector TEXT NOT NULL DEFAULT 'unknown',
        employment_category TEXT,
        public_employment_type TEXT,
        employment_type TEXT NOT NULL DEFAULT 'unknown',
        work_model TEXT NOT NULL DEFAULT 'unknown',

        description TEXT,
        requirements TEXT,
        summary TEXT,

        city TEXT,
        district TEXT,
        location_text TEXT,

        published_at TEXT,
        application_start_at TEXT,
        application_deadline TEXT,
        exam_date TEXT,
        sort_at TEXT NOT NULL,

        salary_min REAL,
        salary_max REAL,
        salary_text TEXT,

        education_levels TEXT NOT NULL DEFAULT '',
        experience_text TEXT,
        experience_years_min INTEGER,
        age_min INTEGER,
        age_max INTEGER,

        kpss_required INTEGER,
        kpss_score_types TEXT NOT NULL DEFAULT '',
        kpss_min_score REAL,
        kpss_year INTEGER,

        gender_requirement TEXT,
        military_requirement TEXT,
        driver_license_requirement TEXT,
        foreign_language_requirement TEXT,
        quota INTEGER,
        legal_status TEXT,

        application_method TEXT NOT NULL DEFAULT 'unknown',
        application_url TEXT,
        application_platform TEXT,

        raw_source_data TEXT,
        parser_version INTEGER NOT NULL,
        fingerprint TEXT NOT NULL,
        duplicate_group_id INTEGER,

        lifecycle TEXT NOT NULL DEFAULT 'active',
        baseline INTEGER NOT NULL DEFAULT 0,
        discovered_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        detail_fetched_at TEXT,
        updated_at TEXT NOT NULL,

        -- Başında ve sonunda boşluk bulunan normalize metinler: LIKE '% kelime%' ile kelime başı aranır.
        headline_norm TEXT NOT NULL DEFAULT '',
        headline_folded TEXT NOT NULL DEFAULT '',
        search_text TEXT NOT NULL DEFAULT '',
        search_folded TEXT NOT NULL DEFAULT '',

        UNIQUE (source_id, source_external_id)
      );

      CREATE INDEX idx_jobs_sort ON jobs (sort_at DESC, id DESC);
      CREATE INDEX idx_jobs_published ON jobs (published_at);
      CREATE INDEX idx_jobs_deadline ON jobs (application_deadline);
      CREATE INDEX idx_jobs_city ON jobs (city, district);
      CREATE INDEX idx_jobs_source ON jobs (source_id);
      CREATE INDEX idx_jobs_fingerprint ON jobs (fingerprint);
      CREATE INDEX idx_jobs_org ON jobs (organization_norm);
      CREATE INDEX idx_jobs_sector ON jobs (sector);
      CREATE INDEX idx_jobs_lifecycle ON jobs (lifecycle);
      CREATE INDEX idx_jobs_group ON jobs (duplicate_group_id);
      CREATE INDEX idx_jobs_discovered ON jobs (discovered_at);
      CREATE INDEX idx_jobs_canonical ON jobs (canonical_url);

      CREATE TABLE favorites (
        job_id INTEGER PRIMARY KEY NOT NULL REFERENCES jobs (id),
        created_at TEXT NOT NULL
      );

      CREATE TABLE hidden_jobs (
        job_id INTEGER PRIMARY KEY NOT NULL REFERENCES jobs (id),
        created_at TEXT NOT NULL
      );

      CREATE TABLE application_status (
        job_id INTEGER PRIMARY KEY NOT NULL REFERENCES jobs (id),
        status TEXT NOT NULL,
        applied_at TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE job_notes (
        job_id INTEGER PRIMARY KEY NOT NULL REFERENCES jobs (id),
        body TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE job_views (
        job_id INTEGER PRIMARY KEY NOT NULL REFERENCES jobs (id),
        first_viewed_at TEXT NOT NULL
      );

      CREATE TABLE reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL REFERENCES jobs (id),
        days_before INTEGER NOT NULL,
        notify_at TEXT NOT NULL,
        notification_id TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (job_id, days_before)
      );

      CREATE TABLE saved_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        filter_json TEXT NOT NULL,
        filter_version INTEGER NOT NULL DEFAULT 1,
        notify INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        last_checked_at TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE sync_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        trigger TEXT NOT NULL,
        new_count INTEGER NOT NULL DEFAULT 0,
        updated_count INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0,
        details_json TEXT
      );
      CREATE INDEX idx_sync_runs_started ON sync_runs (started_at DESC);

      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE notification_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        job_ids TEXT,
        saved_search_id INTEGER
      );
    `);
  },
};
