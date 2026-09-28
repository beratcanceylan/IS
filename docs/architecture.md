# Mimari

Local-first: backend, hesap, bulut veritabanı yok. Veri çekme, parse, normalize, dedup, filtreleme ve
kişisel veriler tamamen cihazda. **SQLite tek doğruluk kaynağıdır**; TanStack Query yalnızca DB
okumalarını önbelleğe alır ve senkron/mutasyon sonrası invalidate edilir.

```
 kaynak (RSS / HTML / JSON)
        │  HttpClient (kaynak başına sıra, bekleme, backoff, 403/429 kuralları)
        ▼
 SourceAdapter.fetchListings / fetchDetails      src/sources/adapters/<kaynak>/
        │  parser.ts  → ham öğe
        │  mapper.ts  → NormalizedJob
        ▼
 enrichFromText (deterministik çıkarım)          src/extraction/
        ▼
 SyncEngine                                       src/sync/sync-engine.ts
        │  cooldown → liste → transaction(upsert + dedup + possiblyRemoved) → anomali → detay → health
        ▼
 SQLite (jobs.db)                                 src/db/
        ▲
        │  repository fonksiyonları (SQL yalnızca burada)
 services/jobs-service.ts → hooks (TanStack Query) → ekranlar (src/app)
```

## Katmanlar

| Klasör | Sorumluluk | Kural |
|---|---|---|
| `src/app/` | Expo Router ekranları | Veri erişimi yok; hook/servis kullanır. Tip/yardımcı koyulmaz |
| `src/components/` | Yeniden kullanılan UI | SQL yok |
| `src/hooks/`, `src/state/` | Query hook'ları, küçük context'ler | |
| `src/services/` | Ekranların çağırdığı veri servisi | Registry + DB ayrıntılarını gizler |
| `src/db/` | Bağlantı, migration, repository | Tüm SQL burada; `Db` arayüzüne bağlı |
| `src/search/` | Filtre → SQL, arama kolonları, FTS sorgusu | |
| `src/sources/` | Adapter arayüzü, registry, adapter'lar | UI'dan habersiz |
| `src/sync/` | Senkron motoru, dedup, kontrolcü | Bildirim vb. `registerAfterSync` ile eklenir |
| `src/extraction/` | KPSS, eğitim, yaş, maaş, konum çıkarımı | Emin olunmayan değer üretilmez |
| `src/domain/` | Tipler | |
| `src/utils/` | Türkçe normalizasyon, tarih, ağ, metin | |

## Veritabanı

- Dosya: `jobs.db`. Sürüm `PRAGMA user_version`'da. Migration'lar `src/db/migrations/00N-*.ts`; her biri
  kendi transaction'ında çalışır, hata olursa geri alınır. **Yayınlanmış bir migration asla değiştirilmez.**
- Tek bağlantı + JS yazma kilidi (`src/db/database.ts`). `withExclusiveTransactionAsync` SDK 57'de
  Android'de ikinci bağlantıyı kapatırken native çökmeye (SIGABRT, statement double-free) yol açtı.
  Tüm yazmalar sıraya girer; transaction içinde yalnızca verilen `tx` kullanılmalıdır (dış `db`
  kullanmak kilidi bekleyip deadlock yapar).
- `jobs`: her satır bir kaynaktaki bir ilan. Kaynaklar arası kopyalar `duplicate_group_id` (= gruptaki
  ilk ilanın id'si) ile bağlanır; akış yalnızca birincilleri gösterir.
- Kişisel tablolar: `favorites`, `hidden_jobs`, `application_status`, `job_notes`, `job_views`, `reminders`.
  Bunlarda kaydı olan ilan otomatik arşivlenmez/silinmez.
- `baseline = 1`: kaynağın ilk başarılı senkronunda gelen ilanlar; "yeni" sayılmaz, bildirim üretmez.
- Arama: `search_text` (Türkçe harfler korunur), `search_folded` (ASCII katlama). Kullanıcı Türkçe
  karakter yazmadıysa katlanmış kolonda aranır. FTS5 varsa `jobs_fts`, yoksa LIKE.

## Yaşam döngüsü

`active` → (tam listede görünmezse) `possiblyRemoved` → (14 gün + son başvurusu geçmiş/bilinmiyor +
kişisel veri yok) `archived`. Son başvurusu geçen ilan `expired`. `purgeOldJobs` yalnızca kişisel verisi
olmayan eski arşiv/süresi dolmuşları siler.

## Deduplication

1. Aynı kaynak: `(source_id, source_external_id)` UNIQUE.
2. Kaynaklar arası aday: aynı fingerprint, aynı normalize kurum ya da aynı canonical URL.
3. Ağırlıklı benzerlik: kurum 0,35 + başlık 0,40 + konum 0,10 + son başvuru 0,15; eşik 0,86.
4. Veto: farklı il/ilçe, farklı kadro sayısı, başlıkta farklı sayılar, 2 günden fazla farklı son başvuru,
   kurum bilinmiyor, aynı kaynak. Bir grupta aynı kaynaktan iki ilan olamaz.

Yanlış birleştirme, kaçırılan duplicate'ten daha kötü sayılır.

## Senkron

- Kaynak başına `minIntervalMinutes` cooldown; elle yenileme (`force`) cooldown'u aşar ama 403/429
  sonrası dinlenmeyi aşmaz.
- Eşzamanlılık: 2 kaynak. Her kaynak kendi `HttpClient`'ı ile istekleri sıraya koyar.
- Hatalar: 5xx/timeout/ağ → en fazla 2 tekrar (2 sn, 4 sn); 403/401 → 24 saat dinlenme; 429 →
  Retry-After (yoksa 1 saat); parser hatası → "Parser kontrol edilmeli" + 10 dk'dan 12 saate backoff.
- Anomali: normalde ≥ beklenen sayıda ilan dönerken 0 veya %20'nin altı → `degraded`, "görünmeyenleri
  kaldır" adımı atlanır.
- Ön plan: uygulama açılışı ve her ön plana gelişte istenir; cooldown gereksiz isteği engeller.
