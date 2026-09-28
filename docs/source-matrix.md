# Kaynak matrisi

Son inceleme: **25 Eylül 2026**, istekler bu makineden (Türkiye IP'si) atıldı. Uygulamanın User-Agent'ı
`IlanTakip/0.1 (personal, non-commercial job tracker; Android)` — tarayıcı taklidi yapılmaz.

İlke: bir kaynak otomatik erişime uygun değilse zorlanmaz. CAPTCHA, WAF, Cloudflare, login veya
tarayıcıya özel imza aşılmaz. Bu kaynaklar `SEARCH_LINK` (uygulama yalnızca tarayıcıda arama sayfasını
açar) veya ileride `MANUAL_IMPORT` olarak tutulur.

## Özet

| Kaynak | Tür | İlan türü | Public erişim | Auth | Resmî API/feed | Public HTML | JS render | Otomatik çekim uygun mu | Mod | Rate limit yaklaşımı | İlk sürüm | Notlar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Kariyer Kapısı** (kariyerkapisi.gov.tr) | Resmî | Kamu: memur, sözleşmeli, işçi, kariyer meslek, yurt dışı eğitim | Evet | Başvuru için e-Devlet; liste ve detay için yok | **Evet: resmî RSS** (`/RSS`, "Güncel ilanları sitene ekle" sayfası) + detay sayfasının kullandığı `GetIlanPreviewPublic` JSON (adında "Public", token yok) | Detay sayfası iskelet | Evet (detay) | **Evet** | `RSS_OR_FEED` (+ detay JSON) | Senkron ≥60 dk arayla; istekler arası 1,5 sn; detay bütçesi 40/senkron; yalnızca yeni/eski parser'lı ilanların detayı | ✅ | RSS ~25 aktif ilan, kararlı GUID. Detay: kurum, birim, BBCode metin, başvuru başlangıç/bitiş, başvuru linki. `kontenjan` çoğunlukla 0 (bilinmiyor). Bazı ilanların `pubDate`'i ileri tarihli |
| **Kamu Personel Alım İlanları** (kamuilan.sbb.gov.tr) | Resmî (Strateji ve Bütçe Bşk.) | Kamu: üniversite, belediye, bakanlık, işçi | Evet | Yok | Hayır | **Evet**, sunucu tarafında render (ASP.NET) | Hayır | **Evet** | `PUBLIC_HTML` | Senkron ≥120 dk; tek sayfa isteği | ✅ | Son ~30 günün ~140 ilanı tek sayfada: kurum, başlık, başvuru aralığı. Detay bağlantıları (`ilanDetay.aspx?kod=`) her yüklemede yeniden şifreleniyor ve oturum çerezine bağlı → kalıcı kimlik içerikten üretilir, "Orijinal ilan" ana sayfayı açar. Detay bir PDF; ilk sürümde indirilmez. robots.txt yok (404) |
| ilan.gov.tr (Basın İlan Kurumu) | Resmî | Kamu personel alımı dahil tüm resmî ilanlar | Site evet | Yok | İç API (`/api/api/services/app/Ad/AdsByFilter`) var ama gateway (Kong) tarayıcı dışı istekleri **403** ile reddediyor | Angular SPA, HTML boş | Evet | **Hayır** (erişim kontrolü aşılmaz) | `SEARCH_LINK` | — | Bağlantı | robots.txt izin verici, ancak sitemap dosyaları 404. İleride resmî bir feed/izin olursa `DIRECT_API` adayı |
| İŞKUR (esube.iskur.gov.tr) | Resmî | Kamu işçi alımları dahil tüm açık iş ilanları | Tarayıcıda evet | Başvuru için | Yok | — | — | **Hayır**: F5 WAF "Request Rejected" (robots.txt bile) | `SEARCH_LINK` | — | Bağlantı | Kamu sürekli işçi ilanlarının çoğu Kariyer Kapısı'nda da yayınlanıyor ve başvuru İŞKUR'a yönlendiriliyor |
| Resmî Gazete | Resmî | Üniversite öğretim üyesi, kurum personel ilanları ("Çeşitli İlânlar") | Evet | Yok | Yok (günlük HTML + PDF) | Evet | Hayır | Kısmen | `SEARCH_LINK` | — | Bağlantı | İlanlar yapılandırılmamış belge. İleride günlük ilan bölümü sayfasından başlık listesi çıkarılabilir (`PUBLIC_HTML` adayı); SBB kaynağı bu ilanların çoğunu zaten derliyor |
| Bakanlık personel duyuru sayfaları | Resmî | Kurum bazlı | Genelde evet | Yok | Nadiren RSS | Kuruma göre değişir | Değişir | Kurum kurum değerlendirilmeli | Gelecek: kurum başına `PUBLIC_HTML`/`RSS_OR_FEED` | Kurum başına ≥6 saat | Hayır | Kariyer Kapısı ve SBB bu ilanların büyük kısmını topluyor; önce boşluk analizi yapılmalı |
| Üniversite personel duyuruları | Resmî | Akademik + idari | Evet | Yok | Bazılarında RSS | Evet | Değişir | Üniversite bazında | Gelecek | ≥6 saat | Hayır | Akademik ilanlar Resmî Gazete + SBB'de. Sözleşmeli personel Kariyer Kapısı'nda |
| Belediyeler / belediye şirketleri | Resmî / kamu şirketi | Memur, işçi, şirket personeli | Değişir | Yok | Nadiren | Değişir | Değişir | Belediye bazında | Gelecek | ≥6 saat | Hayır | Belediye memur ilanları SBB'de görünüyor. Şirket (A.Ş.) ilanları dağınık; il bazlı seçmeli adapter planlanabilir (ör. Tekirdağ) |
| Valilikler | Resmî | Sınırlı | Evet | Yok | Değişir | Evet | Değişir | Değişir | Gelecek | — | Hayır | Nadiren personel ilanı |
| Kariyer.net | Özel | Özel sektör | Evet | Başvuru için | Yok | Kısmen | Evet | **Hayır**: kullanım koşulları otomatik toplamayı yasaklıyor; `/filtre` robots ile kapalı | `SEARCH_LINK` (`/is-ilanlari?kw=`) | — | Bağlantı | |
| LinkedIn Jobs | Özel | Beyaz yaka | Kısmen | Evet | Yok (partner API) | — | Evet | **Hayır** (ToS scraping'i açıkça yasaklıyor, `/jobs-guest/` robots ile kapalı) | `SEARCH_LINK` | — | Bağlantı | |
| Indeed | Toplayıcı | Karışık | Evet | Başvuru için | Yok (publisher API kapandı) | — | Evet | **Hayır** (ToS + bot koruması) | `SEARCH_LINK` | — | Bağlantı | |
| Eleman.net | Özel | Mavi yaka, KOBİ | Evet | Başvuru için | Yok | — | — | **Hayır** (robots.txt ilan/arama sayfalarını kapatıyor) | `SEARCH_LINK` | — | Bağlantı | |
| Yenibiriş | Özel | Özel sektör | — | — | Yok | — | — | **Hayır** (robots.txt dahil 403) | `SEARCH_LINK` | — | Bağlantı | |
| Secretcv | Özel | Özel sektör | Evet | Başvuru için | Yok | — | — | **Hayır** (ToS; `/is-ilanlari/ara` robots ile kapalı) | `SEARCH_LINK` | — | Bağlantı | |
| İşin Olsun | Özel | Mavi yaka, yarı zamanlı | Evet | Başvuru için | Yok | — | Evet | **Hayır** (uygulama odaklı, açık feed yok) | `SEARCH_LINK` | — | Bağlantı | |
| Jooble | Toplayıcı | Karışık | Evet | — | **Resmî API var** (ücretsiz anahtar, kayıt gerekli) | — | — | Site hayır (robots `Disallow: /`); API evet | `SEARCH_LINK`; ileride `DIRECT_API` | API koşullarına göre | Bağlantı | Anahtar mobil uygulamada gizli tutulamaz; kişisel anahtarla, kullanıcının kendi girdiği ayar olarak düşünülebilir |
| Kamu şirketleri (TCDD, PTT, BOTAŞ vb.) | Kamu | Şirket personeli | Evet | Değişir | Nadiren | Evet | Değişir | Değişir | Gelecek | — | Hayır | Çoğu Kariyer Kapısı/İŞKUR üzerinden duyuruluyor |
| MANUAL_IMPORT | — | Her şey | — | — | — | — | — | — | `MANUAL_IMPORT` | — | Planlı | Paylaş menüsü / pano ile URL ekleme; ilan sayfası indirilmez, kullanıcı başlık/kurum girer |

## Adapter modları

- `DIRECT_API`: Resmî/public yapılandırılmış servis.
- `PUBLIC_HTML`: Giriş gerektirmeyen, sunucu tarafında render edilen sayfa. Selector'lar `selectors.ts`'de.
- `RSS_OR_FEED`: RSS/Atom/XML. Tercih edilen yöntem.
- `SEARCH_LINK`: Uygulama siteye istek atmaz; tarayıcıda arama sayfası açılır.
- `MANUAL_IMPORT`: Kullanıcının paylaştığı/yapıştırdığı bağlantı.

## Yeniden kontrol

Bu tablo bir anlık görüntüdür. Bir kaynağın durumu değişirse (ör. ilan.gov.tr resmî bir feed yayınlarsa)
önce bu dosya güncellenir, sonra adapter yazılır.
