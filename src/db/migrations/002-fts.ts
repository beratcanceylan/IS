import type { Migration } from './index';

/**
 * Tam metin arama. `search_text` Türkçe harfleri koruyarak normalize edilmiş, `search_folded`
 * ASCII'ye katlanmış metindir (bkz. utils/turkish-normalization.ts). Tokenizer diakritikleri
 * silmez (`remove_diacritics 0`), böylece "şoför" ile "sofor" ayrı kalır.
 *
 * Cihazdaki SQLite FTS5 içermiyorsa migration hata vermeden atlanır; arama LIKE'a düşer.
 */
export const migration002: Migration = {
  version: 2,
  name: 'fts',
  async up(db) {
    try {
      await db.execAsync(`
        CREATE VIRTUAL TABLE jobs_fts USING fts5(
          search_text,
          search_folded,
          content = 'jobs',
          content_rowid = 'id',
          tokenize = 'unicode61 remove_diacritics 0'
        );
      `);
    } catch (error) {
      await db.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('fts_available', 'false')`);
      console.warn('[db] FTS5 kullanılamıyor, LIKE aramasına geçiliyor', error);
      return;
    }
    await db.execAsync(`
      CREATE TRIGGER jobs_fts_ai AFTER INSERT ON jobs BEGIN
        INSERT INTO jobs_fts (rowid, search_text, search_folded) VALUES (new.id, new.search_text, new.search_folded);
      END;
      CREATE TRIGGER jobs_fts_ad AFTER DELETE ON jobs BEGIN
        INSERT INTO jobs_fts (jobs_fts, rowid, search_text, search_folded)
        VALUES ('delete', old.id, old.search_text, old.search_folded);
      END;
      CREATE TRIGGER jobs_fts_au AFTER UPDATE OF search_text, search_folded ON jobs BEGIN
        INSERT INTO jobs_fts (jobs_fts, rowid, search_text, search_folded)
        VALUES ('delete', old.id, old.search_text, old.search_folded);
        INSERT INTO jobs_fts (rowid, search_text, search_folded) VALUES (new.id, new.search_text, new.search_folded);
      END;
      INSERT INTO jobs_fts (jobs_fts) VALUES ('rebuild');
      INSERT OR REPLACE INTO settings (key, value) VALUES ('fts_available', 'true');
    `);
  },
};
