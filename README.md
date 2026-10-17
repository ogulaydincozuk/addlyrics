# AddLyrics

Sanatçılara aylık paketler halinde, **gerçek editörlerin hazırladığı** şarkıya özel lyrics videolar satan web sitesi ve sipariş yönetim sistemi.

- Açık renkli, mobil uyumlu satış sitesi (ana sayfa, paketler, örnekler, SSS, iletişim, yasal sayfalar)
- 5 adımlı sipariş sihirbazı + güvenli dosya yükleme (ilerleme, iptal, içerik doğrulama)
- Ödeme altyapısı: **iyzico Checkout Form**, **Shopify Storefront/Checkout** (isteğe bağlı) ve geliştirme için **test ödemesi**
- Müşteri paneli: paketler ve video hakları, teslim takvimi, siparişler, ekiple mesajlaşma (üretim öncesi sorular), dosyalar, teslimler, ödemeler
- **Ücretsiz deneme (3 video):** ilk ziyaret penceresi + sağ kenar/mobil alt çubuk, 4 adımlı başvuru, e-posta + SMS doğrulaması (telefon başına en fazla 2 hesap, veritabanında), ekip dosya kontrolü, 3 ayrı video işi, kısa/filigranlı ön izlemeler (süreli imzalı bağlantı), satın almada deneme videolarının yeniden üretilmeden pakete dahil edilmesi
- **İş ortaklığı:** yalnızca yöneticinin oluşturduğu referans/indirim kodları, sunucuda indirim hesabı, doğrulanmış ödemede komisyon, onay/ödeme/iade (mahsup) akışı, iş ortağı paneli (`/ortak`)
- **Duyurular:** yayında duyuru varsa ana sayfada bant/pencere/bildirim; yoksa hiçbir şey çizilmez
- Yönetim paneli: sipariş iş akışı, deneme başvuruları, üretim kuyruğu, abonelikler ve video hakları, iş ortakları, kodlar, komisyon raporu ve ödemeleri, duyurular, sistem ayarları, denetim kayıtları, editör ataması, teslim yayınlama, paket/fiyat yönetimi, içerikler, yasal metinler

> Teknik ayrıntılar: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Deneme/ortaklık akışları: [docs/DENEME-VE-ORTAKLIK.md](docs/DENEME-VE-ORTAKLIK.md) · Yayına alma: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Teknoloji

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL · Prisma 6 · Zod · Argon2id · Vitest

## Hızlı başlangıç (yerel geliştirme)

Gereksinim: Node.js 20.9+ (Docker veya PostgreSQL kurulumu gerekmez).

```bash
npm install
cp .env.example .env          # AUTH_SECRET ve SEED_ADMIN_* değerlerini doldurun
npm run db:start              # 1. terminal: yerel PostgreSQL (127.0.0.1:54329) — açık kalmalı
npm run db:deploy             # 2. terminal: tabloları oluştur
npm run db:seed               # paketler, SSS, yasal taslaklar, örnek videolar, yönetici hesabı
npm run dev                   # http://localhost:3000
```

- Yönetim paneli: `http://localhost:3000/admin` — `.env` içindeki `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` ile giriş.
- Geliştirmede `PAYMENT_PROVIDER=mock`: ödeme adımında **test ödeme sayfası** açılır, gerçek ödeme alınmaz. Üretimde (`NODE_ENV=production`) otomatik kapanır.
- E-postalar geliştirmede (`EMAIL_DRIVER=console`) sunucu konsoluna yazılır (ör. şifre sıfırlama ve e-posta doğrulama bağlantısı).
- SMS doğrulama kodları geliştirmede `SMS_PROVIDER=console` ile sunucu konsoluna yazılır (üretimde bu sağlayıcı otomatik kapalıdır).
- Ön izleme kesitlerini sunucuda üretmek için `FFMPEG_PATH` (isteğe bağlı) — yoksa ön izlemeler editör tarafından ayrı yüklenir.
- Yüklenen dosyalar `./storage` klasörüne kaydedilir (git'e eklenmez).

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` / `npm start` | Üretim derlemesi / sunucusu (düşük bellekli makinede `NEXT_BUILD_CPUS=2 npm run build`) |
| `npm test` | Birim + entegrasyon testleri (`TEST_DATABASE_URL` veritabanını kullanır ve temizler) |
| `npm run typecheck` · `npm run lint` | Tür denetimi · ESLint |
| `npm run db:start` | Yerel geliştirme PostgreSQL'i (embedded-postgres) |
| `npm run db:migrate` | Şema değişikliğinden yeni migration üret (geliştirme) |
| `npm run db:deploy` | Migration'ları uygula (üretim/CI) |
| `npm run db:seed` | Başlangıç verisi (tekrar çalıştırılabilir; mevcut kayıtların üzerine yazmaz) |
| `npm run maintenance` | Yarım kalan yüklemeleri ve süresi dolan oturumları temizler, geciken denemeler için uyarı gönderir, saklama süresi dolan deneme dosyalarını siler (**saatlik** cron önerilir) |
| `npm run test-user` | Yalnızca geliştirme: `.env` içindeki `TEST_ADMIN_*`, `TEST_USER_*`, `TEST_PARTNER_*` bilgileriyle yönetici, e-posta/telefon onaylı müşteri ve iş ortağı test hesaplarını oluşturur veya şifrelerini yeniler (yerel veritabanı dışında çalışmaz) |

## Paketler ve iş kuralları (mevcut durum)

| Paket | Fiyat | Video | Teslimler |
| --- | --- | --- | --- |
| 1 Aylık | 3.200 TL | 30 | 30 |
| 2 Aylık | 6.200 TL | 60 | 30 / 30 |
| 3 Aylık | 9.400 TL | 90 + 15 bonus | 30 / 30 / 45 |

- Fiyatlar, video sayıları ve bonuslar **yönetim panelinden** (`/admin/paketler`) değiştirilebilir. Fiyat değişikliği mevcut siparişleri etkilemez (sipariş anındaki koşullar saklanır).
- **Paketlerde revizyon hakkı yoktur.** Üretime başlamadan önce ekip gerekli soruları sipariş sayfasından (Admin → sipariş → "Müşteriye soru / not gönder") sorar; müşteri panelden yanıtlar, videolar netleşen tercihlere göre hazırlanır.
- Teslim kuralı: ayın 1–15'i arasındaki alımlarda ilk 30 video **5 iş günü** içinde, 16'sından sonraki alımlarda izleyen ayın 1'inde; sonraki teslimler her ayın 1'inde. İş günü hesabı hafta sonlarını ve sabit tarihli resmî tatilleri atlar; dini bayramlar dahil değildir (gerekirse teslim tarihi admin panelinden elle güncellenir). Kural: `src/lib/delivery-plan.ts` → `deliveryDates`.
- Paket hakkı ödeme onaylandığı anda başlar, paket süresi sonunda biter. Haklar yalnızca **doğrulanmış ödeme** ile tanımlanır. Otomatik yenileme yoktur ("abonelik dönemi" = paket dönemi).
- **Ücretsiz denemeden satın alma:** 3 deneme videosu pakete dahildir (paket bazında değiştirilebilir). Ör. 30 videoluk pakette 3 deneme + 27 yeni = 30; kalan ilk teslim videoları ödeme onayından itibaren en geç 5 iş günü (paket/sistem ayarı). Ayrıntılar: [docs/DENEME-VE-ORTAKLIK.md](docs/DENEME-VE-ORTAKLIK.md).

## Gerçek hesap / anahtar gerektiren özellikler

Bu özellikler yapılandırılmadan **çalışıyormuş gibi gösterilmez**; yönetim panelindeki *Entegrasyonlar* ve *Satışa hazırlık* ekranları gerçek durumu gösterir.

| Özellik | Gerekenler | Yapılandırılmazsa |
| --- | --- | --- |
| iyzico ile kart ödemesi | `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, iyzico panelinde webhook + imza (X-IYZ-SIGNATURE-V3) | Paketler "Online ödeme yakında" olarak görünür, satın alınamaz |
| Shopify ile satış (isteğe bağlı) | `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_WEBHOOK_SECRET` (+ önerilen `SHOPIFY_ADMIN_ACCESS_TOKEN`), paketlerin Shopify varyantlarıyla eşlenmesi | Shopify ödeme yolu kapalı; site bağımsız çalışır |
| E-posta | `EMAIL_DRIVER=smtp` + `SMTP_*` | E-postalar yalnızca sunucu günlüğüne yazılır |
| Ölçeklenebilir dosya depolama | `STORAGE_DRIVER=s3` + `S3_*` (AWS S3 / Cloudflare R2 / MinIO) | Yerel disk (tek sunucu) |
| TikTok örnek kapak görselleri | TikTok oEmbed'e erişim | Videolar yine oynar; kartta sade kapak gösterilir |
| Telefon doğrulama (SMS) | `SMS_PROVIDER=twilio` + `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Telefon doğrulanamaz → ücretsiz deneme başlatılamaz (sistem ayarlarında uyarı) |
| Otomatik ön izleme kesiti + filigran | `FFMPEG_PATH` (overlay/scale2ref/boxblur filtreli tam ffmpeg) | Ön izlemeyi editör ayrı dışa aktarıp yükler; filigran yoksa "filigranlı" gösterilmez |

## Hukuki not

Kullanım Koşulları, Gizlilik Politikası, KVKK Aydınlatma Metni, İptal/İade Politikası, Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formu **taslaktır**. Yayına almadan önce bir hukuk danışmanına inceletin ve şirket bilgilerini (`/admin/icerik`) doldurun. İncelenmeyen metinlerde sitede taslak uyarısı görünür.
