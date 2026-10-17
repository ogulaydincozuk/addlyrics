# Yayına Alma Rehberi

## 1. Gerekenler

| Bileşen | Öneri |
| --- | --- |
| Uygulama sunucusu | Node.js 20.9+ çalıştırabilen bir ortam: Vercel, Railway, Render, Fly.io veya kendi sunucunuz (PM2/systemd + Nginx) |
| Veritabanı | Yönetilen PostgreSQL 15+ (Neon, Supabase, Railway, AWS RDS…). Yerel `npm run db:start` yalnızca geliştirme içindir. |
| Dosya depolama | S3 uyumlu, **herkese kapalı** kova: Cloudflare R2, AWS S3 veya MinIO |
| E-posta | SMTP hizmeti (Resend, Postmark, Amazon SES, Brevo…) |
| Ödeme | iyzico üye işyeri hesabı **veya** Shopify mağazası |
| Alan adı | HTTPS zorunlu (`APP_URL=https://…`) |

## 2. Ortam değişkenleri

`.env.example` dosyasındaki değişkenleri barındırma ortamına girin. Üretimde mutlaka:

- `NODE_ENV=production` (çoğu platform otomatik ayarlar) — test ödemesi ve örnek paketler otomatik kapanır.
- `APP_URL` → `https://alanadiniz.com`
- `AUTH_SECRET` → yeni, rastgele, en az 32 karakter
- `PAYMENT_PROVIDER=iyzico` (veya `shopify`) ve ilgili anahtarlar
- `STORAGE_DRIVER=s3` ve `S3_*`
- `EMAIL_DRIVER=smtp`, `SMTP_*`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`
- `ALLOW_TEST_PAYMENTS=false`, `ALLOW_SAMPLE_PACKAGES=false`

Gizli anahtarları depoya eklemeyin; `.env*` dosyaları `.gitignore` içindedir (`.env.example` hariç).

## 3. Veritabanı

```bash
npm ci
npx prisma migrate deploy      # migration'ları uygular
npm run db:seed                # yönetici (SEED_ADMIN_*), fiyatlı paketler (taslak), SSS, yasal taslaklar, örnek videolar
```

Seed, paketleri belirlenen fiyat, video sayısı ve teslim planıyla **yayında** oluşturur; satın alma, gerçek bir ödeme sağlayıcısı yapılandırıldığında açılır. `SEED_ADMIN_PASSWORD` değerini seed'den sonra ortamdan kaldırabilirsiniz.

## 4. Derleme ve çalıştırma

```bash
npm run build      # veritabanına erişim gerekir (herkese açık sayfaların statik kabuğu)
npm start          # varsayılan port 3000
```

Bellek kısıtlı ortamda: `NEXT_BUILD_CPUS=2 npm run build`.

### Çok sunuculu / serverless kurulum notları
- Hız sınırlayıcı bellek içidir; birden çok örnekte Redis (ör. Upstash) tabanlı bir depoya geçirin (`src/server/rate-limit.ts`).
- `STORAGE_DRIVER=local` yalnızca tek sunucu içindir; serverless ortamda S3/R2 zorunludur.
- `'use cache'` varsayılan olarak örnek başına bellekte tutulur; içerik güncellemeleri `updateTag` ile yenilenir.

## 5. Dosya depolama (Cloudflare R2 örneği)

1. Herkese kapalı bir kova oluşturun, API token'ı (Object Read & Write) alın.
2. `S3_ENDPOINT=https://<hesap-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
3. Kova CORS kuralı (tarayıcıdan doğrudan yükleme için):

```json
[{ "AllowedOrigins": ["https://alanadiniz.com"], "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
```

## 6. iyzico

1. iyzico panelinden API ve gizli anahtarı alın; önce **sandbox** (`IYZICO_BASE_URL=https://sandbox-api.iyzipay.com`) ile test edin.
2. Bildirim (webhook) adresi: `https://alanadiniz.com/api/payments/iyzico/webhook`. `X-IYZ-SIGNATURE-V3` imzasının hesabınızda açılması için iyzico entegrasyon ekibiyle iletişime geçin.
3. Dönüş adresi (`/api/payments/iyzico/callback`) uygulama tarafından otomatik gönderilir.
4. Sandbox test kartlarıyla başarılı ve başarısız ödemeyi deneyin; admin → Ödemeler ekranında kayıtları, müşteri panelinde paket hakkını kontrol edin.
5. Canlıya geçerken `IYZICO_BASE_URL=https://api.iyzipay.com` ve canlı anahtarlar.

## 7. Shopify (isteğe bağlı)

1. Shopify'da her paket için bir dijital ürün oluşturun (fiyat AddLyrics fiyatıyla **birebir** aynı, para birimi TRY).
2. Bir Shopify uygulaması (Headless veya özel uygulama) ile Storefront API erişim anahtarı alın; sipariş doğrulaması için `read_orders` yetkili Admin API anahtarı önerilir.
3. Webhook'lar: `orders/paid`, `refunds/create`, `orders/cancelled` → `https://alanadiniz.com/api/payments/shopify/webhook`; uygulamanın imza anahtarını `SHOPIFY_WEBHOOK_SECRET` olarak girin.
4. Admin → Paketler → paket → **Shopify eşlemesi**: ürün ve varyant GID'lerini girin, "Fiyatı Shopify'dan doğrula".
5. `PAYMENT_PROVIDER=shopify` yapın.

## 8. Ücretsiz deneme ve doğrulama

- **SMS:** Twilio'da bir Verify hizmeti oluşturun; `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`. Türkiye'ye SMS gönderimi için gönderici/şablon kurallarını sağlayıcıyla doğrulayın. Yapılandırılmazsa deneme başlatılamaz.
- **ffmpeg (isteğe bağlı):** sunucuya `overlay`, `scale2ref`, `boxblur` filtreli tam bir ffmpeg kurun ve `FFMPEG_PATH` tanımlayın. Filigran görseli `assets/watermark.png`. Yönetim → Sistem Ayarları ekranı filtre desteğini gösterir.
- **Ayarlar:** Yönetim → Sistem Ayarları: ön izleme hedefi (24 sa), kesit süresi, kapasite, kalan videolar için iş günü, saklama süresi, KDV oranı ve komisyon onay bekleme süresi. Paket bazında deneme kuralı: Yönetim → Paketler.
- **İçerik:** deneme koşulları sayfası ve güncel KVKK taslağı için bir kez `npx tsx prisma/scripts/2026-10-trial-content.ts` (KVKK sayfasındaki admin düzenlemelerinin üzerine yazar). Hukuki metinler taslaktır.
- Ayrıntılar ve uçtan uca akışlar: [DENEME-VE-ORTAKLIK.md](DENEME-VE-ORTAKLIK.md). Geri alma: [rollback/](rollback/).

## 9. Zamanlanmış görev

Günde bir kez: `npm run maintenance` (yarım kalan yüklemeler ve süresi dolan oturumlar).

`npm run maintenance` artık deneme gecikme uyarılarını ve saklama süresi dolan deneme dosyalarının silinmesini de yapar; **saatte bir** çalıştırılması önerilir.

## 10. Satışa başlamadan önce kontrol listesi

Admin → Gösterge Paneli'ndeki **Satışa hazırlık** listesi bu maddeleri canlı olarak denetler:

- [ ] Gerçek ödeme sağlayıcısı yapılandırıldı ve sandbox'ta uçtan uca test edildi
- [ ] Paket fiyatları, video sayıları ve teslim planı son kez kontrol edildi (Admin → Paketler)
- [ ] Dini bayram dönemlerine denk gelen ilk teslim tarihleri kontrol edildi (iş günü hesabı yalnızca sabit tarihli tatilleri bilir)
- [ ] Yasal metinler hukuk danışmanı tarafından incelendi ve "incelendi" olarak işaretlendi (cayma hakkı istisnası için gerekirse ödeme adımına ayrıca açık onay eklenmeli)
- [ ] Şirket unvanı, adres, telefon, e-posta, MERSİS no girildi
- [ ] SSS'deki "Doğrulanmalı" cevaplar gözden geçirildi
- [ ] SMTP ile test e-postası alındı (Admin → Entegrasyonlar)
- [ ] S3/R2 depolama ve CORS yapılandırıldı; büyük dosya yükleme denendi
- [ ] Portfolyodaki örnek videoların kullanım izinleri var
- [ ] En az bir aktif editör eklendi
- [ ] Veritabanı yedeklemesi açık

## 11. Vercel'de yayın (GitHub'dan otomatik)

Repo Vercel'e bağlıdır; `main` dalına her push yeni bir canlı yayın başlatır. Ayarlar `vercel.json` içindedir:

- **Derleme:** `node scripts/vercel-build.mjs` → migration'lar (havuzsuz bağlantıyla) → `prisma/seed.ts` → `next build`.
  Seed tekrar çalıştırılabilir; mevcut içeriğin üzerine yazmaz. Yönetici hesabı yalnızca `SEED_ADMIN_EMAIL` ve
  `SEED_ADMIN_PASSWORD` tanımlıysa (ve yoksa) oluşturulur. Şifreyi yalnızca Vercel panelinden sen gir.
- **Bölge:** `fra1` (Frankfurt). Veritabanını da aynı bölgede aç.
- **Veritabanı:** Vercel → Storage → Neon (Postgres). Entegrasyon `DATABASE_URL` (havuzlu) ve
  `DATABASE_URL_UNPOOLED` değişkenlerini ekler; uygulama havuzlu bağlantıya `pgbouncer=true` ekleyerek bağlanır (`src/server/db.ts`).
- **Dosyalar:** Vercel → Storage → Blob, erişim **Private**. `STORAGE_DRIVER=vercel-blob`. Tarayıcı dosyayı tek dosyaya
  ve tek içerik türüne kilitli, 1 saat geçerli imzalı bağlantıyla doğrudan depoya yükler; izleme/indirme yetki
  kontrolünden sonra 5 dakika geçerli imzalı bağlantıyla yapılır. İndirilen dosyanın adı depolama anahtarıdır
  (orijinal ad panelde görünür).
- **Bakım:** Vercel Cron günde bir kez `/api/cron/maintenance` çağırır (`CRON_SECRET` gerekir). Hobby planında cron
  günde en fazla bir kez çalışır; deneme gecikme uyarılarının saatlik çalışması için Pro plan veya harici bir zamanlayıcı gerekir.
- **Hız sınırlama** bellek içidir; serverless ortamda örnekler arasında paylaşılmaz (bkz. §4 notları).

Canlı ortamda zorunlu değişkenler: `AUTH_SECRET` (en az 32 karakter, sabit), `APP_URL`, `STORAGE_DRIVER=vercel-blob`,
`CRON_SECRET`. Ödeme anahtarları yokken `PAYMENT_PROVIDER=none` ile site satış kapalı açılır. SMS (Twilio) ve SMTP
tanımlanmadan ücretsiz deneme pop-up'ı gösterilmez ve deneme sayfası "yakında" der (`trialPrerequisitesReady`).
