# Ücretsiz deneme, abonelik dönemi, iş ortaklığı ve duyurular

Bu belge Ekim 2026'da eklenen sistemleri, iş kurallarını ve uçtan uca akışları anlatır.
Kod: `src/server/domain/{trials,referrals,announcements}.ts`, `src/server/verification/*`, `src/lib/{trial,referral,phone,announcements}.ts`.

## 1. Mimari kararlar

| Konu | Karar | Neden |
| --- | --- | --- |
| Abonelik | **Paket dönemi** olarak modellenir (`PackageEntitlement`: başlangıç/bitiş, toplam/kullanılan video). Otomatik yenileme ve tekrarlayan tahsilat **yok**. Yenileme = yeniden satın alma; iade = hakkın kapatılması. | Mevcut ödeme altyapısı tek seferlik; sitede ve reklamlarda "otomatik yenileme yok" vaadi var. |
| Video üretimi | Projede yapay zekâ/otomatik video üretimi (Ollama, Whisper vb.) **yok**. Deneme videoları da gerçek editör akışıyla üretilir: editör tam ana dosyayı dışa aktarır, ekip yükler. | Var olmayan bir entegrasyon varmış gibi gösterilmez. |
| Ön izleme | `FFMPEG_PATH` tanımlıysa ana dosyadan kısa kesit (≤720p, düşük bit hızı, istenirse logo filigranı/bulanıklık) sunucuda üretilir. Değilse editörün dışa aktardığı kısa kesit yüklenir. Filigran filtresi yoksa sistem "filigranlı" demez. | Tam sürüm, ön izlemeden "bulanıklık kaldırılarak" değil, orijinal ana dosyadan teslim edilir. |
| Ses-söz eşleşmesi | Otomatik konuşma tanıma yok. Müşteri beyanı + otomatik kontroller (ses dosyası var/geçerli/yeterli boyut, sözler en az 2 satır) + **ekibin dosya kontrolü** adımı. | Ön izleme süresi (24 sa) yalnızca ekip dosyaları onayladığında başlar. |
| SMS | `SMS_PROVIDER`: `twilio` (Twilio Verify) veya yalnızca geliştirmede `console`. Yapılandırılmazsa telefon doğrulanamaz ve deneme başlatılamaz. | SMS gönderildiği varsayılmaz. |

## 2. Telefon ve e-posta doğrulama

- Kayıtta e-posta **ve** telefon zorunlu. Telefon ülke koduyla E.164'e normalize edilir (`src/lib/phone.ts`): `0532…`, `532…`, `+90 532…` → `+905321234567`.
- **Telefon başına en fazla 2 doğrulanmış hesap** veritabanında uygulanır: `PhoneAccountSlot (phone, slot)` benzersiz + `CHECK (slot IN (1,2))`. Doğrulama `INSERT … ON CONFLICT DO NOTHING` ile yuva alır; eşzamanlı isteklerde üçüncü hesap yuva bulamaz (testte 4 eşzamanlı istekten 2'si başarılı).
- Kodlar HMAC özeti olarak saklanır, 10 dk geçerli, en fazla 5 deneme; yeniden gönderme 60 sn bekleme, saatlik/günlük sınırlar (veritabanında) + IP hız sınırı.
- E-posta doğrulama bağlantısı 24 saat geçerli; belirteç sayfa açılınca değil butona basılınca tüketilir (e-posta tarayıcılarının bağlantıyı önceden açması doğrulamayı harcamaz).
- Doğrulanmış telefon profilden değiştirilemez.

## 3. Ücretsiz deneme akışı

Aşamalar (`TrialStage`): Başvuru alındı → Dosyalar kontrol ediliyor ⇄ Eksik bilgi bekleniyor → Üretim kuyruğunda → Üretimde → Editör kontrolünde → Ön izleme hazır → Tamamlandı · Hata oluştu · İptal.

1. **Tanıtım:** İlk ziyarette (yalnızca bir kez) açılır pencere; kapatılınca masaüstünde sağ kenarda sekme, mobilde alt çubuk. Deneme kapalıysa, kapasite doluysa veya kullanıcının denemesi/paketi varsa hiç gösterilmez. Duyuru penceresiyle aynı anda açılmaz.
2. **Başvuru** (`/ucretsiz-deneme`): giriş + e-posta/telefon doğrulaması gerekir; hesap başına bir deneme; paket almış müşteriler hariç. 4 adım: şarkı ve sözler → dosyalar (ses zorunlu; klip, görsel, görüntü, söz dosyası isteğe bağlı) → tercihler (öncelikli tarz, format, görüntü kaynağı, not) → onaylar (haklar, ses-söz eşleşmesi, koşullar/KVKK). Eksik/hatalı dosyada başvuru **oluşmaz**, eksikler listelenir.
3. **Dosya kontrolü** (Admin → Deneme Başvuruları): ekip dosyaları onaylar → 3 video işi kuyruğa girer, **ön izleme hedefi = onay anı + 24 saat** (ayarlanabilir). Ya da "Müşteriden ek bilgi iste" → müşteri panelden düzeltip yeniden gönderir.
4. **Üretim:** her video ayrı iş (editör ataması, durum, hata, deneme sayısı). Ana dosya yüklenir → ffmpeg varsa ön izleme otomatik üretilir, yoksa ön izleme elle yüklenir → **kalite kontrol onayı** → video "Ön izleme hazır".
5. Üç video hazır olunca müşteriye **bir kez** e-posta + panel bildirimi.
6. **Gecikme:** `npm run maintenance` (saatlik önerilir) hedefi aşan denemeler için ekibe uyarı ve müşteriye gecikme bildirimi gönderir (bir kez). Hatalı işler Üretim Kuyruğu'ndan yeniden kuyruğa alınır.
7. **Ön izleme güvenliği:** müşteri yalnızca kendi denemesini görür; ön izleme ve kapak 20 dk geçerli imzalı bağlantıyla (`/api/deneme-medya/{video}/{preview|poster}`) ve oturum kontrolüyle sunulur. Ana dosya bu rotadan asla sunulmaz; `/api/files` üzerinden de ödeme sonrası teslim yayınlanana kadar açılmaz.
8. **Saklama:** satın alınmayan denemelerin dosyaları ayarlanan süre (varsayılan 90 gün) sonunda silinir.

## 4. Denemeden satın almaya geçiş

- Müşteri panelinde: **Videolarımı İncele · Paketi Satın Al · Daha Sonra Karar Ver**.
- `/panel/deneme/satin-al`: her paket için dönüşüm planı gösterilir (`trialConversionPlan`):
  - Paket kuralı "deneme videoları pakete dahil" (varsayılan): ilk teslim = 3 deneme + (ilk teslim − 3) yeni video. **30 videoluk pakette 3 + 27 = 30.** 3 aylık pakette ilk teslim 30 (3+27), toplam 105.
  - Kural "dahil değil": deneme videoları pakete eklenir (toplam hak = paket + 3).
  - Kalan ilk teslim videoları ödeme onayından itibaren **en geç N iş günü** (paket ayarı, yoksa sistem ayarı; varsayılan 5). Hafta sonu ve sabit resmî tatiller atlanır. Sonraki aylar mevcut "ayın 1'i" planıyla.
- Ödeme yalnızca sağlayıcıdan doğrulanınca işlenir (webhook/callback imza kontrolü, tutar/para birimi/referans karşılaştırması). Doğrulanınca tek işlemde:
  - deneme bu siparişe bağlanır (`convertedOrderId` benzersiz — iki kez dönüştürülemez),
  - denemede yüklenen dosyalar siparişe bağlanır (yeniden yükleme yok),
  - 3 deneme videosu siparişin ilk 3 projesi olur (**yeniden üretilmez**), ana dosyaları **son kalite kontrol bekleyen teslim** olarak bağlanır,
  - kalan projeler teslim tarihleriyle oluşur, paket hakkı tanımlanır (kullanılan = siparişteki video sayısı),
  - kodla gelmişse komisyon kaydı oluşur.
- Aynı bildirim tekrar gelirse hiçbir şey ikinci kez oluşmaz (ödeme durumu koşullu güncelleme + benzersiz kısıtlar).
- Ekip, ana dosyaları siparişten "Müşteriye teslim et" ile yayınlar; yalnızca doğrulanmış ve iade edilmemiş ödemesi olan siparişte mümkündür. Üç tam sürüm yayınlanınca deneme "Tamamlandı" olur.
- Her video hakkının hangi videoya harcandığı: Admin → **Abonelikler ve Haklar** (siparişler ve proje sayıları; döküm–sayaç uyuşmazlığı işaretlenir).

## 5. İş ortaklığı, referans kodları ve komisyon

- **Yalnızca yöneticiler** iş ortağı ve kod oluşturur/düzenler (kontrol hem sayfada hem servis katmanında; testle doğrulanır). İş ortakları kod üretemez, oranı değiştiremez.
- Kod alanları: kod (benzersiz, büyük harf), iş ortağı, indirim (% veya TL), genel komisyon oranı, **paket bazında komisyon oranı** (isteğe bağlı; ör. genel %10, 3 aylık pakette %7,5 — boş paketlerde genel oran geçerlidir, ödeme anında siparişin paketine göre seçilir ve kullanılan oran komisyon kaydında saklanır), **komisyon tabanı** (liste fiyatı / tahsil edilen tutar / KDV hariç tahsilat — her kodda açıkça seçilir, varsayılan yok), başlangıç-bitiş, kullanım limiti, aktiflik, geçerli paketler.
- Müşteri kodu **ödeme sayfasında** girer; doğrulama ve indirim sunucuda hesaplanır, sipariş kaydına liste fiyatı, indirim, kod ve iş ortağı yazılır. Ödeme başlatılırken kod yeniden doğrulanır. Kendi kodunu kullanmak engellenir.
- Komisyon yalnızca **doğrulanmış ödemede** oluşur (sipariş başına bir kayıt), hesaplama dökümüyle saklanır. Durumlar: Beklemede → Onaylandı → Ödendi · İptal edildi.
  - Onay için iade/cayma süresi (Sistem Ayarları, varsayılan 14 gün) dolmalı.
  - İade: ödenmemiş komisyon iptal; ödenmiş komisyon "mahsup edilecek" işaretlenir ve sonraki ödemeden düşülür.
  - Ödeme kaydı yönetici tarafından girilir (yöntem, referans, tarih) ve denetim kaydına yazılır.
- İş ortağı paneli (`/ortak`): kendi kodları, kullanım sayısı, atfedilen siparişler (müşteri adı maskeli, iletişim bilgisi yok), bekleyen/onaylı/ödenmiş/iptal komisyonlar, ödemeler. Başka iş ortağının verisini göremez; yetkisiz erişim 404 döner.
- Panel hesabı: Admin → İş Ortakları → "Panel hesabı oluştur" (şifre belirleme bağlantısı e-postayla, 72 saat).

## 6. Duyurular

- Admin → Duyurular: taslak, yayınla/yayından kaldır, başlangıç/bitiş, öncelik, gösterim (üst bant / açılır pencere / küçük bildirim), isteğe bağlı buton.
- Ana sayfa yalnızca yayında ve tarih aralığındaki en öncelikli (eşitse en yeni) duyuruyu gösterir; **aktif duyuru yoksa hiçbir şey çizilmez**. Kapatılan duyurunun aynı sürümü o tarayıcıda tekrar gösterilmez.

## 7. Yönetim paneli bölümleri

Gösterge Paneli (deneme ve komisyon özetleri dahil) · Deneme Başvuruları · Üretim Kuyruğu · Siparişler · Ödemeler · Abonelikler ve Haklar · Müşteriler (doğrulama durumları) · İş Ortakları · Referans Kodları · Satış ve Komisyonlar · Komisyon Ödemeleri · Paketler (deneme kuralları) · Duyurular · Sistem Ayarları · Denetim Kayıtları · (mevcut diğer bölümler).

Erişim: `/admin` — yalnızca `ADMIN` rolü; yetki her sayfada ve her sunucu eyleminde yeniden kontrol edilir.

## 8. Uçtan uca akışlar (yerelde doğrulandı)

**Deneme → ön izleme → satın alma → 30 video**

1. Ziyaretçi açılır pencereden "Ücretsiz Denemeyi Başlat" → hesap oluşturur (telefon zorunlu) → e-posta bağlantısı + SMS kodu ile doğrular.
2. 4 adımlı başvuruyu gönderir (ses dosyası gerçek yükleme hattından geçer: başlatma → yükleme → içerik imzası kontrolü). Durum: "Dosyalar kontrol ediliyor".
3. Ekip dosyaları onaylar → "Üretim kuyruğunda", hedef = +24 saat. Ana dosyalar yüklenir → ön izlemeler üretilir → kalite kontrol onayı → "Ön izleme hazır", müşteriye e-posta + bildirim.
4. Müşteri üç ön izlemeyi panelde karşılaştırır (imzalı bağlantı; değiştirilmiş belirteç 404) → "Paketi Satın Al" → 1 Aylık Paket → ödeme sayfasında kod girer → öder.
5. Sonuç: 30 video işi (3 deneme + 27 yeni, yeniler 5 iş günü), hak 30/30, 3 tam sürüm "son kontrol bekliyor" → ekip yayınlar → müşteri 6 MB'lık temiz tam sürümü indirir; ön izleme dosyası `/api/files`'tan açılmaz. Deneme "Tamamlandı".

**İş birliği → referans kodu → satış → komisyon**

1. Admin iş ortağı oluşturur (ad, iletişim, sosyal hesaplar) → kod tanımlar (ör. RAP10: %10 indirim, %15 komisyon, taban: tahsil edilen tutar).
2. Müşteri ödeme sayfasında RAP10 girer → 3.200 TL → 2.880 TL; sipariş iş ortağına bağlanır.
3. Doğrulanmış ödeme → komisyon 432 TL "Beklemede", onaylanabilir tarih = ödeme + 14 gün.
4. Süre dolunca admin onaylar → Komisyon Ödemeleri'nden ödeme kaydı girer (denetim kaydı). İade olursa komisyon iptal/mahsup edilir.
5. İş ortağı `/ortak` panelinde kodunu, satışı (maskeli müşteri), komisyon durumunu ve ödemelerini görür.

## 9. Migration ve geri alma

- Migration: `prisma/migrations/20261017150000_trial_partners_announcements` (yalnızca ekleme; mevcut veri değişmez). CHECK kısıtları migration SQL'inin sonundadır.
- Migration: `prisma/migrations/20261017220000_referral_package_rates` — pakete özel komisyon oranları tablosu (yalnızca ekleme). Geri alma: `docs/rollback/20261017220000_referral_package_rates.down.sql`.
- Geri alma: `docs/rollback/20261017150000_trial_partners_announcements.down.sql` (yeni tabloları/sütunları kaldırır; enum değerleri PostgreSQL'de kaldırılamadığı için yerinde kalır. Migration bu değerleri `ADD VALUE IF NOT EXISTS` ile eklediği için geri alma sonrası yeniden uygulanabilir — test veritabanında denendi). Uygulamadan önce yedek alın ve bir önceki uygulama sürümüne dönün.
- İçerik güncellemesi (deneme koşulları sayfası + KVKK taslağı): `npx tsx prisma/scripts/2026-10-trial-content.ts`.

## 10. Paylaşım bağlantısı ve kolay erişim (Ekim 2026)

- İş ortağı panelinde her geçerli kod için paylaşım bağlantısı (`/paketler?kod=KOD`), "Kodu kopyala" ve "Paylaşım metnini kopyala" düğmeleri bulunur.
- Bağlantıyla gelen ziyaretçinin kodu tarayıcıda 30 gün saklanır; sipariş özetine geçerken kod otomatik doldurulup kontrol edilir, ödeme sayfasındaki kod alanına da önceden yazılır. İndirim ve komisyon her zaman sunucuda doğrulanır.
- Müşteri sipariş özetinde (canlı indirim önizlemesiyle) veya ödeme sayfasının en üstünde kod girebilir.
- Müşteri mesajları yönetimde **Mesajlar** gelen kutusunda (yanıt bekleyenler üstte, menüde sayı rozeti) ve sipariş sayfasındaki "Müşteriyle mesajlaşma" bölümünde görünür; ekip sorusu yanıt bekleyen müşteriye panelde uyarı ve menü rozeti gösterilir.
