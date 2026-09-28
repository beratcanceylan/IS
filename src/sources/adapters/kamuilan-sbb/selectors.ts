/**
 * kamuilan.sbb.gov.tr ana sayfasının zaman çizelgesi (ASP.NET WebForms, sunucu tarafında render).
 * Site HTML'i değişirse DEĞİŞTİRİLECEK TEK YER burasıdır; ardından
 * tests/fixtures/kamuilan-sbb/timeline.html güncellenip parser testleri çalıştırılmalıdır.
 *
 * <ul id="nav2" class="cbp_tmtimeline">
 *   <li>
 *     <time class="cbp_tmtime"><h4>25</h4><h3> Eylül</h3></time>
 *     <div class="cbp_tmlabel">
 *       <a href="ilanDetay.aspx?kod=...">
 *         <div><img class="limg2" src="./ilan_dosyalar/logolar/407.png"/>
 *           <p class="alt_p1">KURUM</p>
 *           <p class="alt_p2"> 3 ÖĞRETİM ÜYESİ ALACAK<em> ( 25 Eylül - 8 Aralık) </em></p>
 * ...
 */
export const SELECTORS = {
  dayGroup: 'ul#nav2 > li',
  dayNumber: 'time h4',
  monthName: 'time h3',
  listing: 'div.cbp_tmlabel > a',
  organization: 'p.alt_p1',
  title: 'p.alt_p2',
  applicationRange: 'p.alt_p2 em',
  logo: 'img',
} as const;
