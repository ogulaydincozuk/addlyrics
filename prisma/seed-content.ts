// Başlangıç içerikleri. Tüm metinler admin panelinden düzenlenebilir.
// Hukuki metinler TASLAKTIR: yayına almadan önce bir hukuk danışmanına inceletilmelidir.
// Köşeli parantezli alanlar [ … ] şirket bilgileriyle doldurulmalıdır.

export const FAQ_SEED: Array<{ question: string; answer: string; needsReview: boolean }> = [
  {
    question: "AddLyrics nedir?",
    answer:
      "AddLyrics, sanatçılara aylık paketler halinde şarkıya özel lyrics videolar hazırlayan profesyonel bir hizmet markasıdır. Paketini seçersin, şarkını ve görsel tercihlerini gönderirsin; AddLyrics ile çalışan editörler videolarını hazırlar ve müşteri panelinden teslim eder.",
    needsReview: false,
  },
  {
    question: "Videoları kim hazırlıyor?",
    answer:
      "Videolarını AddLyrics ile çalışan gerçek video editörleri hazırlar. Siparişin ekibimiz tarafından incelenir ve seçtiğin görsel tarza uygun bir editöre atanır.",
    needsReview: false,
  },
  {
    question: "Yapay zekâ mı, gerçek editörler mi çalışıyor?",
    answer:
      "Videolar insan editörler tarafından hazırlanır. AddLyrics otomatik bir video üretim aracı değildir; her video, şarkına ve tercihlerine göre bir editör tarafından düzenlenir.",
    needsReview: false,
  },
  {
    question: "Kendi müzik klibimi gönderebilir miyim?",
    answer:
      "Evet. \"Kendi klibim üzerine lyrics\" tarzını seçersen klibini sipariş formundan ya da daha sonra müşteri panelinden yükleyebilirsin (MP4 veya MOV). Gönderdiğin klibin kullanım haklarına sahip olman gerekir.",
    needsReview: false,
  },
  {
    question: "Film edit tarzında lyrics video hazırlatabilir miyim?",
    answer:
      "Paketin bu tarzı kapsıyorsa evet. Film edit videolarda yalnızca kullanım hakkı bulunan görüntüler kullanılır: lisanslı stok görüntüler ya da kullanım hakkına sahip olduğun görüntüler. Telif hakkıyla korunan film sahneleri izinsiz kullanılmaz.",
    needsReview: true,
  },
  {
    question: "Şarkımı nasıl göndereceğim?",
    answer:
      "Paketini seçtikten sonra açılan sipariş formunda şarkı dosyanı (WAV veya MP3), şarkı sözlerini ve görsel tercihlerini paylaşırsın. Dosyaların hazır değilse siparişini oluşturup dosyaları daha sonra müşteri panelinden yükleyebilirsin.",
    needsReview: false,
  },
  {
    question: "Paketimde toplam kaç video var?",
    answer:
      "Her paketin toplam video sayısı ve video başına maliyeti paket kartlarında ve sipariş özetinde açıkça yazar. Satın aldıktan sonra toplam, kullanılan ve kalan video haklarını müşteri panelinde görebilirsin.",
    needsReview: false,
  },
  {
    question: "Videoları ne zaman teslim alırım?",
    answer:
      "Videolar paket süresi boyunca aylık toplu olarak teslim edilir: her teslimde 30 video, 3 aylık pakette son teslimde 15 bonus video ile birlikte 45 video. Ayın 1–15'i arasında satın aldıysan ilk 30 video 5 iş günü içinde, 16'sından sonra satın aldıysan izleyen ayın 1'inde teslim edilir; sonraki teslimler her ayın 1'indedir. Teslim tarihlerin müşteri panelindeki \"Paketlerim\" bölümünde görünür; videoların teslim edildiğinde e-posta ile haber veririz.",
    needsReview: false,
  },
  {
    question: "Revizyon hakkım var mı?",
    answer:
      "Paketlerde revizyon hakkı bulunmuyor. Bunun yerine üretime başlamadan önce ekibimiz gerekli soruları sana sorar ve tercihlerini netleştirir; videolar bu bilgilere göre hazırlanır. Sorularımızı müşteri panelindeki sipariş sayfandan yanıtlayabilirsin.",
    needsReview: false,
  },
  {
    question: "Birden fazla şarkı için paket kullanabilir miyim?",
    answer:
      "Paketindeki video haklarını paket süresi boyunca farklı şarkılar için kullanabilirsin. İlk şarkını sipariş sırasında gönderirsin; kalan hakların için müşteri panelindeki \"Yeni Şarkı Gönder\" adımıyla yeni sipariş oluşturursun.",
    needsReview: true,
  },
  {
    question: "Videoları sosyal medyada kullanabilir miyim?",
    answer:
      "Teslim edilen videolar şarkının tanıtımı için sosyal medya hesaplarında ve müzik platformlarında kullanılmak üzere hazırlanır. Kullanım kapsamı Kullanım Koşulları'nda yer alır. Videoda kullanılan müzik, söz ve görüntülerin haklarına sahip olman gerekir.",
    needsReview: true,
  },
  {
    question: "Paketim ne zaman başlar ve biter?",
    answer:
      "Paketin, ödemen onaylandığı anda başlar ve paket süresi (1, 2 veya 3 ay) sonunda sona erer. Başlangıç ve bitiş tarihlerini müşteri panelindeki \"Paketlerim\" bölümünde görebilirsin.",
    needsReview: true,
  },
  {
    question: "Paketimi satın aldıktan sonra ne yapmam gerekiyor?",
    answer:
      "Sipariş sırasında eksik bıraktığın dosyalar varsa müşteri panelinden yüklemen yeterli. Ekibimiz siparişini inceler ve gerekirse sipariş sayfandan sorular sorar; yanıtladıktan sonra siparişin bir editöre atanır. Tüm süreci panelden takip edebilirsin.",
    needsReview: false,
  },
  {
    question: "İptal ve iade koşulları nelerdir?",
    answer:
      "İptal ve iade koşulları İptal ve İade Politikası sayfasında açıklanır. Kişiye özel hazırlanan dijital hizmetlerde cayma hakkına ilişkin yasal istisnalar uygulanabilir; satın almadan önce bu sayfayı incelemeni öneririz.",
    needsReview: true,
  },
];

const DRAFT_NOTE =
  "> Bu metin bir taslaktır ve yayına alınmadan önce hukuk danışmanı tarafından incelenmelidir. Köşeli parantez içindeki alanlar şirket bilgileriyle doldurulmalıdır.";

export const PAGE_SEED: Array<{ slug: string; title: string; metaDescription: string; isLegal: boolean; body: string }> = [
  {
    slug: "hakkimizda",
    title: "Hakkımızda",
    metaDescription: "AddLyrics, sanatçılara profesyonel editörlerin hazırladığı şarkıya özel lyrics videolar sunan bir hizmet markasıdır.",
    isLegal: false,
    body: `AddLyrics, şarkılarını düzenli olarak tanıtmak isteyen sanatçılar için kuruldu.

Yeni bir şarkı çıkardığında her video için ayrı bir editör aramak, ayrı ayrı fiyat konuşmak ve süreci takip etmek zaman alır. AddLyrics bu süreci tek bir pakette toplar: paketini seçersin, şarkını gönderirsin, AddLyrics ile çalışan editörler videolarını hazırlar.

## Neler yapıyoruz?

- Sinematik görüntülerle film edit lyrics videolar
- Tipografiye odaklanan minimal lyrics videolar
- Sanatçının kendi klibi üzerine senkronize sözler

## Nasıl çalışıyoruz?

Videolar insan editörler tarafından, şarkına ve tercihlerine göre hazırlanır. İzlenme, dinlenme veya viral olma garantisi vermiyoruz; sunduğumuz hizmet profesyonelce hazırlanmış lyrics videolardır.`,
  },
  {
    slug: "kullanim-kosullari",
    title: "Kullanım Koşulları",
    metaDescription: "AddLyrics web sitesi ve lyrics video hizmetinin kullanım koşulları.",
    isLegal: true,
    body: `${DRAFT_NOTE}

## 1. Taraflar ve kapsam

Bu koşullar, [Şirket Unvanı] ("AddLyrics") tarafından sunulan web sitesi ve lyrics video hazırlama hizmetinin kullanımını düzenler.

## 2. Hizmetin niteliği

AddLyrics, müşterinin gönderdiği şarkı, söz ve görseller kullanılarak insan editörler tarafından lyrics video hazırlanması hizmetidir. AddLyrics; izlenme, dinlenme, takipçi artışı veya ticari başarı garantisi vermez.

## 3. Müşterinin beyan ve yükümlülükleri

- Müşteri, gönderdiği şarkı, şarkı sözü, müzik klibi, görsel ve diğer materyaller üzerinde gerekli tüm kullanım haklarına sahip olduğunu beyan eder.
- Üçüncü kişilerin haklarını ihlal eden içerikler nedeniyle doğabilecek taleplerden müşteri sorumludur.
- Hesap bilgilerinin gizliliğinden müşteri sorumludur.

## 4. Görüntü kullanımı

Film edit videolarda yalnızca lisanslı stok görüntüler veya müşterinin kullanım hakkına sahip olduğu görüntüler kullanılır. Telif hakkıyla korunan film sahneleri izinsiz kullanılmaz.

## 5. Teslim edilen videoların kullanımı

[Teslim edilen videoların kullanım kapsamı, lisans süresi, ticari kullanım ve platform kısıtları burada tanımlanmalıdır — HUKUKİ İNCELEME GEREKLİ]

## 6. Paket hakları

Paket, ödemenin onaylandığı tarihte başlar ve paket süresi sonunda sona erer. Paket kapsamındaki video sayısı ve teslim koşulları satın alma anında gösterilen paket bilgilerine göre uygulanır. Paketlerde revizyon hakkı bulunmaz; üretime başlamadan önce gerekli bilgiler müşteriden alınır ve videolar bu bilgilere göre hazırlanır.

## 7. Değişiklikler

AddLyrics bu koşulları güncelleyebilir. Satın alınmış paketler, satın alma anındaki koşullara tabidir.

## 8. İletişim

[E-posta] · [Adres]`,
  },
  {
    slug: "gizlilik-politikasi",
    title: "Gizlilik Politikası",
    metaDescription: "AddLyrics kişisel verilerin korunması ve gizlilik politikası.",
    isLegal: true,
    body: `${DRAFT_NOTE}

## Topladığımız bilgiler

- Hesap bilgileri: ad soyad, sanatçı adı, e-posta adresi
- Sipariş bilgileri: şarkı bilgileri, şarkı sözleri, video tercihleri
- Yüklenen dosyalar: şarkı dosyası, müzik klibi, görseller
- Fatura bilgileri: ad soyad, telefon, şehir, adres ve isteğe bağlı T.C. kimlik numarası
- Teknik bilgiler: oturum çerezi, IP adresi ve tarayıcı bilgisi (güvenlik amacıyla)

## Ödeme bilgileri

Kart bilgileri yalnızca ödeme kuruluşunun güvenli ödeme sayfasında girilir. AddLyrics kart numarası, son kullanma tarihi veya güvenlik kodu gibi kart bilgilerini görmez ve saklamaz.

## Dosyaların güvenliği

Yüklediğin dosyalar herkese açık değildir. Dosyalarına yalnızca sen ve siparişini hazırlayan AddLyrics ekibi erişebilir.

## Çerezler

Sitede yalnızca oturumunu sürdürmek için zorunlu bir çerez kullanılır. [Analitik veya pazarlama çerezleri eklenirse çerez politikası ve onay mekanizması eklenmelidir.]

## Gömülü içerikler

Örnek videolar TikTok'un resmî gömülü oynatıcısıyla gösterilir. Oynatıcı yalnızca bir videoyu oynatmak için tıkladığında yüklenir; bu durumda TikTok'un kendi çerez ve gizlilik koşulları geçerlidir. Kapak görselleri TikTok sunucularından yüklenebilir.

## Haklarınız

KVKK kapsamındaki haklarına ilişkin ayrıntılar KVKK Aydınlatma Metni'nde yer alır. Talepler için: [E-posta]`,
  },
  {
    slug: "kvkk-aydinlatma-metni",
    title: "KVKK Aydınlatma Metni",
    metaDescription: "6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında aydınlatma metni.",
    isLegal: true,
    body: `${DRAFT_NOTE}

## Veri sorumlusu

[Şirket Unvanı], [Adres], [MERSIS No]

## İşlenen kişisel veriler

Kimlik (ad soyad, isteğe bağlı T.C. kimlik no), iletişim (e-posta, telefon, adres), müşteri işlem (sipariş, ödeme kayıtları, kullanılan indirim/referans kodu), işlem güvenliği (IP adresi, oturum kayıtları, doğrulama kayıtları) ve müşterinin yüklediği içerikler (ses dosyası, şarkı sözleri, görsel ve videolar).

## İşleme amaçları

- Sözleşmenin kurulması ve ifası (lyrics video hazırlama ve teslim)
- Ücretsiz deneme kapsamında örnek videoların hazırlanması ve ön izlemelerin sunulması
- Hesabın e-posta ve telefon doğrulaması; bir telefon numarasıyla en fazla 2 hesap doğrulanabilmesi kuralının uygulanması (kötüye kullanımın önlenmesi)
- Ödeme ve faturalandırma süreçlerinin yürütülmesi
- İş ortağı/referans kodu ile yapılan satışların ilgili iş ortağına atfedilmesi ve komisyon hesabı (iş ortağı yalnızca maskelenmiş ad ve sipariş özetini görür)
- Müşteri iletişimi ve destek
- Bilgi güvenliğinin sağlanması, işlem ve yönetici denetim kayıtlarının tutulması ve hukuki yükümlülüklerin yerine getirilmesi

## Saklama süreleri

- Satın almaya dönüşmeyen ücretsiz deneme dosyaları (yüklenen dosyalar, ön izlemeler ve deneme videoları) sistem ayarlarında belirtilen süre sonunda (varsayılan 90 gün) silinir.
- Sipariş, ödeme ve fatura kayıtları ilgili mevzuatta öngörülen süre boyunca saklanır. [Süreler — HUKUKİ İNCELEME GEREKLİ]
- Doğrulama kodları yalnızca özet (hash) olarak saklanır ve kısa süre sonra geçersiz olur.

## Hukuki sebepler

KVKK m.5/2 kapsamında sözleşmenin ifası, hukuki yükümlülük ve meşru menfaat. [Açık rıza gerektiren işlemeler varsa ayrıca belirtilmelidir.]

## Aktarım

Ödeme kuruluşu ([iyzico / Shopify]), dosya depolama, e-posta ve SMS doğrulama hizmet sağlayıcıları ile hizmetin sunulması için gerekli ölçüde. [Yurt dışı aktarım varsa KVKK m.9 kapsamındaki şartlar değerlendirilmelidir — HUKUKİ İNCELEME GEREKLİ]

## Haklarınız

KVKK m.11 kapsamındaki taleplerini [E-posta] adresine iletebilirsin.`,
  },
  {
    slug: "ucretsiz-deneme-kosullari",
    title: "Ücretsiz Deneme Koşulları",
    metaDescription: "AddLyrics ücretsiz deneme: 3 örnek lyric video, ön izleme ve satın alma koşulları.",
    isLegal: true,
    body: `${DRAFT_NOTE}

## Kapsam

Ücretsiz denemede, gönderdiğin şarkı ve materyallerle 3 farklı yaklaşımla lyric video hazırlanır ve kısa ön izlemeleri müşteri panelinde gösterilir. Deneme ücretsizdir; ödeme veya kart bilgisi istenmez.

## Kimler başvurabilir?

- Henüz paket satın almamış, e-posta adresi ve telefon numarası doğrulanmış kullanıcılar.
- Her hesap için bir deneme. Bir telefon numarasıyla en fazla 2 hesap doğrulanabilir.
- Üretim kapasitemiz dolduğunda yeni başvuru alınmayabilir.

## Süreç ve süreler

- Başvurudan sonra ekibimiz dosyaların üretime uygun olduğunu ve ses dosyası ile sözlerin aynı şarkıya ait olduğunu kontrol eder. Eksik veya hatalı dosya varsa başvuru üretime alınmaz ve senden ek bilgi istenir.
- Ön izleme süresi dosyaların onaylandığı anda başlar. Hedefimiz bu andan itibaren 24 saat içinde üç ön izlemeyi hazırlamaktır (süre, sistem ayarlarında belirtildiği şekliyle). Gecikme olursa seni bilgilendiririz.

## Ön izleme ve tam sürüm

- Ön izlemeler kısa bir kesittir, logo filigranı içerebilir ve indirilemez. Yalnızca senin hesabından, süreli bağlantılarla görüntülenebilir.
- Paket satın aldığında aynı üç videonun tam, temiz ve indirilebilir sürümleri yeniden üretilmeden teslim edilir. Tam sürümler ödemen doğrulandıktan sonra açılır.
- Deneme videoları, paket koşullarında belirtildiği şekilde paketin video hakkına dahil sayılır (ör. 30 videoluk pakette 3 deneme videosu + 27 yeni video).

## Saklama

Satın almaya dönüşmeyen denemelerin dosyaları ve ön izlemeleri, sistem ayarlarında belirtilen süre (varsayılan 90 gün) sonunda silinir.

## Haklar

Gönderdiğin şarkı ve materyallerin kullanım haklarına sahip olduğunu beyan edersin. Hak ihlali tespit edilirse deneme sonlandırılabilir. [Ayrıntılar — HUKUKİ İNCELEME GEREKLİ]`,
  },
  {
    slug: "iptal-ve-iade-politikasi",
    title: "İptal ve İade Politikası",
    metaDescription: "AddLyrics paketleri için iptal, cayma ve iade koşulları.",
    isLegal: true,
    body: `${DRAFT_NOTE}

## Tek seferlik ödeme

AddLyrics paketleri tek seferlik ödeme ile satın alınır. Otomatik yenileme veya tekrarlayan tahsilat yapılmaz.

## Cayma hakkı

[Mesafeli Sözleşmeler Yönetmeliği kapsamında cayma hakkı süresi, kişiye özel hazırlanan hizmetler ve tüketicinin onayıyla cayma süresi içinde ifasına başlanan hizmetlere ilişkin istisnalar burada açıkça düzenlenmelidir. İstisnadan yararlanılacaksa tüketiciden ayrıca açık onay alınması gerekebilir — HUKUKİ İNCELEME GEREKLİ]

## İptal

- Ödemesi tamamlanmamış siparişler herhangi bir ücret doğmadan iptal edilebilir.
- Ödemesi tamamlanmış ancak üretimine başlanmamış siparişler için: [koşul belirlenmeli]
- Üretimine başlanmış veya teslim edilmiş videolar için: [koşul belirlenmeli]

## İade süreci

İade talepleri [E-posta] adresine sipariş numarasıyla iletilir. Onaylanan iadeler, ödemenin yapıldığı yönteme [süre] içinde yapılır. İade edilen ödemeye bağlı paket hakları kapatılır.`,
  },
  {
    slug: "mesafeli-satis-sozlesmesi",
    title: "Mesafeli Satış Sözleşmesi",
    metaDescription: "AddLyrics lyrics video paketleri mesafeli satış sözleşmesi.",
    isLegal: true,
    body: `${DRAFT_NOTE}

## 1. Taraflar

**Satıcı / Hizmet sağlayıcı:** [Şirket Unvanı], [Adres], [Telefon], [E-posta], [MERSIS No]

**Alıcı:** Sipariş sırasında bilgileri alınan müşteri.

## 2. Konu

Alıcının siparişini verdiği lyrics video paketinin (paket adı, süresi, video sayısı ve teslim planı sipariş özetinde belirtildiği şekilde) hazırlanması ve dijital olarak teslimi.

## 3. Bedel ve ödeme

Paket bedeli, vergiler dahil olarak sipariş özetinde gösterilen tutardır. Ödeme tek seferde, ödeme kuruluşunun güvenli ödeme sayfası üzerinden alınır.

## 4. İfa ve teslim

Videolar müşteri paneli üzerinden dijital olarak teslim edilir. Teslim koşulları paket bilgilerinde belirtilir.

## 5. Cayma hakkı

[Cayma hakkı ve istisnaları — HUKUKİ İNCELEME GEREKLİ]

## 6. Uyuşmazlıklar

[Tüketici hakem heyetleri ve tüketici mahkemelerine ilişkin hüküm — HUKUKİ İNCELEME GEREKLİ]`,
  },
  {
    slug: "on-bilgilendirme-formu",
    title: "Ön Bilgilendirme Formu",
    metaDescription: "AddLyrics paket satın alımı öncesi ön bilgilendirme formu.",
    isLegal: true,
    body: `${DRAFT_NOTE}

## Satıcı bilgileri

[Şirket Unvanı] · [Adres] · [Telefon] · [E-posta] · [MERSIS No]

## Hizmetin temel nitelikleri

İnsan editörler tarafından, müşterinin gönderdiği şarkıya özel hazırlanan lyrics videolar. Paketin süresi, toplam video sayısı ve teslim planı sipariş özetinde yer alır. Paketlerde revizyon hakkı bulunmaz; üretime başlamadan önce gerekli bilgiler müşteriden alınır.

## Toplam bedel

Vergiler dahil toplam bedel sipariş özetinde gösterilir. Ek ücret alınmaz. [Varsa ek ücretler belirtilmeli]

## Ödeme ve teslim

Ödeme tek seferde alınır; otomatik yenileme yoktur. Teslim müşteri paneli üzerinden dijital olarak yapılır.

## Cayma hakkı

[Cayma hakkı ve istisnaları — HUKUKİ İNCELEME GEREKLİ]

## Şikâyet ve itiraz

[Başvuru yolları — HUKUKİ İNCELEME GEREKLİ]`,
  },
];

// Gerçek örnek videolar (AddLyrics tarafından seçildi). TikTok'un resmî gömülü oynatıcısıyla
// gösterilir; videolar indirilmez veya yeniden barındırılmaz.
export const REAL_PORTFOLIO_SEED: Array<{
  title: string;
  description: string;
  category: "FILM_EDIT" | "MINIMAL" | "MUSIC_VIDEO";
  orientation: "VERTICAL";
  embedId: string;
  authorHandle: string;
}> = [
  {
    title: "Film edit lyrics — örnek 1",
    description: "Sinematik sahneler üzerine yerleştirilmiş şarkı sözleri.",
    category: "FILM_EDIT",
    orientation: "VERTICAL",
    embedId: "7697345731677457684",
    authorHandle: "pluxer6",
  },
  {
    title: "Film edit lyrics — örnek 2",
    description: "Film atmosferi ve sözlerin ritimle buluştuğu dikey video.",
    category: "FILM_EDIT",
    orientation: "VERTICAL",
    embedId: "7697510650230148372",
    authorHandle: "pluxer6",
  },
  {
    title: "Düz font lyrics",
    description: "Sade yerleşim ve okunaklı, düz bir yazı tipiyle sözlere odaklanan video.",
    category: "MINIMAL",
    orientation: "VERTICAL",
    embedId: "7695782418019519765",
    authorHandle: "yildizcltr",
  },
  {
    title: "Klip üzerine lyrics",
    description: "Sanatçının klibi üzerine senkronize edilmiş şarkı sözleri.",
    category: "MUSIC_VIDEO",
    orientation: "VERTICAL",
    embedId: "7696785479689178388",
    authorHandle: "valorlyricss",
  },
];

// Stil önizlemeleri: gerçek müşteri işi DEĞİL; sitenin yerleşik animasyonlu önizlemeleri (isDemo=true).
// Gerçek örnekler varken yayında değildir; admin panelinden yayına alınabilir.
export const PORTFOLIO_SEED: Array<{
  title: string;
  description: string;
  category: "FILM_EDIT" | "MINIMAL" | "MUSIC_VIDEO";
  orientation: "VERTICAL" | "HORIZONTAL" | "SQUARE";
  demoPreset: string;
}> = [
  {
    title: "Gün batımı film edit",
    description: "Sinematik renk paleti, geniş ekran kadraj ve alt yazı stilinde sözler.",
    category: "FILM_EDIT",
    orientation: "HORIZONTAL",
    demoPreset: "film-dusk",
  },
  {
    title: "Kinetik tipografi",
    description: "Siyah zemin üzerinde ritimle beliren kalın kelimeler.",
    category: "MINIMAL",
    orientation: "VERTICAL",
    demoPreset: "minimal-mono",
  },
  {
    title: "Sahne ışıkları",
    description: "Klip görüntüsü üzerinde kelime kelime vurgulanan sözler.",
    category: "MUSIC_VIDEO",
    orientation: "VERTICAL",
    demoPreset: "clip-stage",
  },
  {
    title: "Gece şehri",
    description: "Şehir ışıkları ve yumuşak geçişlerle dikey film edit.",
    category: "FILM_EDIT",
    orientation: "VERTICAL",
    demoPreset: "film-night",
  },
  {
    title: "Pastel minimal",
    description: "Açık renk zemin, sade yerleşim ve okunaklı söz satırları.",
    category: "MINIMAL",
    orientation: "SQUARE",
    demoPreset: "minimal-paper",
  },
  {
    title: "Stüdyo performansı",
    description: "Yatay klip üzerinde senkron sözler ve sade alt bant.",
    category: "MUSIC_VIDEO",
    orientation: "HORIZONTAL",
    demoPreset: "clip-studio",
  },
];
