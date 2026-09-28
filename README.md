# İlan Takip

Türkiye'deki kamu ve özel sektör iş ilanlarını tek listede takip etmek için kişisel Android uygulaması.
Sorduğu tek soru: **"Bana uygun yeni bir ilan çıktı mı?"**

- Hesap, sunucu, bulut, analitik yok. Her şey cihazdaki `jobs.db` SQLite dosyasında.
- Kaynaklardan veriyi cihaz kendisi çeker; yalnızca izin veren, herkese açık kaynaklar (resmî RSS,
  sunucu tarafında render edilen sayfalar). İzin vermeyenler için yalnızca arama bağlantısı açılır.
- Aynı ilan birden fazla kaynakta yayınlanırsa tek satırda gösterilir.
- İnternetsiz açıldığında indirilmiş ilanlar eksiksiz görünür.

Kaynakların güncel durumu ve neden bazılarının otomatik çekilmediği: [docs/source-matrix.md](docs/source-matrix.md).
Katmanlar, DB, dedup ve senkron kuralları: [docs/architecture.md](docs/architecture.md).

## Durum

**Milestone 1** tamam ve Android emulator'de (Expo Go, SDK 57) uçtan uca denendi:
iki gerçek kaynak (Kariyer Kapısı RSS + detay, SBB Kamu Personel Alım İlanları), akış, arama, filtreler,
ilan detayı, favori/gizle/durum/not, kaynaklar arası dedup, kaynak sağlığı ekranı, geliştirici ekranı.

Sıradaki: kayıtlı aramalar → arka plan senkronu → yerel bildirimler → son başvuru hatırlatıcıları →
yedekleme (JSON dışa/içe aktarma) → "Benim kriterlerim" profili.

## Kurulum

Gereken: Node 22.5+ (testler Node'un yerleşik `node:sqlite` modülünü kullanır), Android için Expo Go
(SDK 57) veya Android SDK + emulator.

```bash
npm install
npm run android        # Metro'yu başlatır ve bağlı cihaz/emulator'de Expo Go'yu açar
```

Fiziksel telefonda: telefon ve bilgisayar aynı ağdayken `npx expo start` → Expo Go ile QR kodu okut.

Paket eklerken her zaman `npx expo install <paket>` kullan (SDK ile uyumlu sürümü seçer).

### Development build (arka plan senkronu ve bildirimler için)

`expo-background-task` ve bildirimlerin tam davranışı Expo Go'da test edilemez. O aşamada:

```bash
npm run android:dev    # = npx expo run:android  (android/ klasörü üretilir, elle düzenlenmez)
# veya bulutta:
npx eas-cli@latest build --profile development --platform android
```

`android/` ve `ios/` klasörleri `app.json`'dan üretilir (Continuous Native Generation) ve git'e girmez.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm test` | Tüm birim/entegrasyon testleri (ağ kullanmaz) |
| `npm run typecheck` | Uygulama + testler için `tsc --noEmit` |
| `npm run lint` | ESLint (expo config) |

## Veritabanı

- Dosya: `jobs.db` (uygulama veri klasöründe). Uygulama güncellendiğinde silinmez.
- Şema sürümü `PRAGMA user_version`. Migration eklemek için `src/db/migrations/00N-ad.ts` oluştur,
  `src/db/migrations/index.ts`'deki listeye ekle. **Var olan migration'ı değiştirme.** Migration
  testleri `tests/db/repositories.test.ts`'de; hatalı migration'ın geri alındığı da test edilir.
- Tüm SQL `src/db/repositories/*` içinde. Ekranlar `src/services/jobs-service.ts` ve hook'ları kullanır.
- Repository'ler küçük bir `Db` arayüzüne bağlıdır (`src/db/types.ts`). Testlerde aynı SQL, Node'un
  SQLite'ı üzerinde çalışır (`tests/helpers/node-db.ts`), yani filtreler, FTS, dedup ve yaşam döngüsü
  gerçek SQLite ile test edilir.
- Transaction içinde yalnızca callback'e verilen `tx`'i kullan; dış `db` yazma kilidini bekler ve kilitlenir.

## Yeni kaynak adapter'ı ekleme

1. Önce `docs/source-matrix.md`'ye kaynağı ekle: public mi, robots/ToS ne diyor, feed var mı, anti-bot var mı.
   Otomatik erişime uygun değilse `src/sources/adapters/search-links/index.ts`'e `SEARCH_LINK` olarak ekle ve dur.
2. `src/sources/adapters/<kaynak-id>/` oluştur:
   - `parser.ts`: ham yanıt → ham öğeler. Beklenen yapı yoksa **hata fırlat** (sessizce `[]` dönme).
   - `selectors.ts` (HTML kaynaklarında): tüm CSS selector'lar tek yerde.
   - `mapper.ts`: ham öğe → `NormalizedJob`. Bilinmeyen alanı `null`/`'unknown'` bırak; KPSS, eğitim,
     yaş gibi alanlar metinden `enrichFromText` ile otomatik çıkarılır.
   - `index.ts`: `SyncSourceAdapter` (`id`, `mode`, `minIntervalMinutes`, `requestDelayMs`,
     `expectedMinCount`, `parserVersion`, `fetchListings`, isteğe bağlı `fetchDetails`/`detailBudget`).
   - `sourceExternalId` kararlı olmalı. Kaynak kalıcı kimlik vermiyorsa içerikten üret (bkz. `kamuilan-sbb`).
   - Liste kaynağın tüm aktif ilanlarını içeriyorsa `complete: true` dön; kayan pencere/sayfalama varsa `false`.
3. `src/sources/registry.ts`'e ekle. Ekranlar ve senkron motoru başka bir yerde değişiklik gerektirmez.
4. Gerçek yanıttan küçük bir fixture kaydet (`tests/fixtures/<kaynak-id>/`) ve parser testini yaz.

Parser değişince `parserVersion`'ı artır: o kaynaktaki ilanların detayları yeniden çekilir.

## Parser testleri

```bash
npm test -- tests/sources
```

Testler yalnızca `tests/fixtures/` altındaki kayıtlı yanıtları kullanır, siteye istek atmaz. Kaynak HTML'i
değiştiğinde: yeni sayfayı fixture olarak kaydet, test hangi alanın bozulduğunu gösterir, düzeltme
genelde yalnızca `selectors.ts`'dedir.

## Kaynak sağlığı

Ayarlar → Kaynaklar. Her kaynak için son başarılı kontrol, son senkronda yeni ilan, aktif ilan sayısı ve
durum (Çalışıyor / Kontrol edilmeli / Güncellenemedi / Erişim reddedildi / Parser kontrol edilmeli).
"Geliştirici ayrıntıları"nda son istek zamanı, HTTP durumu, parser sürümü, hata, ayrıştırılan ilan sayısı,
süre ve bir sonraki izinli istek zamanı görünür.

Anomali: kaynak normalde en az `expectedMinCount` ilan dönerken 0 dönerse (veya önceki sayının %20'sinin
altına düşerse) başarı sayılmaz, `degraded` olur ve mevcut ilanlar "kaldırıldı" işaretlenmez.

Bir kaynağın bozulması akışı etkilemez; akış önbellekteki ilanları göstermeye devam eder ve yalnızca
küçük bir "1 kaynak güncellenemedi" satırı çıkar.

## Senkron ve arka plan sınırlamaları

- Şu an: uygulama açıldığında, ön plana her gelişte ve aşağı çekince. Kaynak başına cooldown
  (Kariyer Kapısı 60 dk, SBB 120 dk) gereksiz isteği engeller; aşağı çekmek cooldown'u aşar.
- Arka plan senkronu (sonraki aşama) `expo-background-task` ile yapılacak. **İşletim sistemi zamanlamayı
  garanti etmez**: Android WorkManager pil, ağ ve Doze durumuna göre görevi geciktirebilir veya
  atlayabilir. Uygulama "her 30 dakikada kontrol eder" gibi bir vaatte bulunmaz; yalnızca minimum aralık
  seçilir.

## Yedekleme

Planlı (Ayarlar → Veri): favoriler, başvuru durumları, notlar, kayıtlı aramalar ve tercihler JSON olarak
dışa aktarılacak; önbellekteki ilanlar isteğe bağlı. JSON içe aktarma ile geri yükleme.

## Gizlilik ve güvenlik

- Analytics, Firebase, Sentry, reklam SDK'sı, telemetri yok.
- Konum, kamera, mikrofon, rehber izinleri istenmez; `app.json`'da ayrıca engellenmiştir. Konum
  kullanıcı tarafından il/ilçe listesinden seçilir.
- Uygulama hiçbir şifre (e-Devlet, İŞKUR, LinkedIn…) istemez veya saklamaz; başvurular kaynağın kendi
  sitesinde tarayıcıda yapılır.
- Kaynak koduna API anahtarı konmaz. Mobil uygulamada bir anahtarı gizli tutmak zaten mümkün değildir.

## Klasör yapısı

```
src/
  app/                 Expo Router ekranları (yalnızca ekran)
    (tabs)/            Akış, Ara, Kaydedilenler, Ayarlar
    job/[id].tsx       İlan detayı
    filters/           Filtre modalı ve kategori ekranları
    sources/           Kaynak listesi ve sağlık detayı
    onboarding.tsx, locations.tsx, developer.tsx
  components/          Tekrar kullanılan UI (common, jobs, filters, sources)
  data/locations.ts    81 il + 973 ilçe (assets/data/provinces.json), konum çıkarımı
  db/                  Bağlantı, migration'lar, repository'ler
  domain/              Tipler (JobPosting, JobFilter, Source)
  extraction/          KPSS, eğitim, yaş, maaş, deneyim, kadro, statü çıkarımı
  hooks/, state/       Query hook'ları, ayarlar ve filtre taslağı context'leri
  search/              Filtre → SQL, arama kolonları, FTS sorgusu
  services/            Ekranların kullandığı veri servisi
  sources/             Adapter arayüzü, registry, adapter'lar
  sync/                Senkron motoru, dedup, kontrolcü
  theme/               Renk, boşluk, tipografi
  utils/               Türkçe normalizasyon, tarih, ağ, metin, gösterim
tests/                 Jest testleri ve fixture'lar
docs/                  Kaynak matrisi, mimari
```
