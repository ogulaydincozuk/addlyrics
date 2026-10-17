# AddLyrics — Mimari

## Klasör yapısı

```
prisma/                 Şema, migration'lar, seed ve tek seferlik veri betikleri (prisma/scripts)
src/app/(site)/         Herkese açık site, giriş/kayıt, sipariş sihirbazı, ödeme ve müşteri paneli (/panel)
src/app/admin/          Yönetim paneli (yalnızca ADMIN)
src/app/api/            Dosya yükleme/indirme, ödeme dönüşü ve webhook uç noktaları
src/app/odeme/test/     Geliştirme için test ödeme sayfası (üretimde 404)
src/components/         Arayüz bileşenleri (ui, home, order, upload, portfolio, lyrics)
src/content/            Admin'den düzenlenebilen içeriklerin şemaları ve varsayılanları
src/i18n/               Dil yapılandırması ve arayüz metinleri (tr)
src/lib/                Saf iş kuralları (paket, teslim planı, durum makinesi, doğrulama, para)
src/server/             Sunucuya özel kod: auth, db, domain, payments, storage, email, queries
tests/                  Vitest birim ve entegrasyon testleri
```

`src/lib` istemci ve sunucuda çalışabilen **saf** fonksiyonlardır; veritabanı veya gizli anahtar içermez. `src/server` altındaki her modül `server-only` ile işaretlidir.

## Veri modeli

```
User ─┬─ Session (sha256 token)          Package ─┬─ PackageChannelListing (Shopify ürün/varyant eşlemesi)
      ├─ Song ── Order ─┬─ Project (video işi) ── Deliverable (editör teslimi, sürüm)
      │                 ├─ UploadedFile (müşteri dosyaları)
      │                 ├─ Payment ── PackageEntitlement (video hakkı)
      │                 ├─ EditorAssignment ── Editor (ileride Editor.userId → EDITOR hesabı)
      │                 └─ OrderEvent (durum geçmişi / notlar)
      └─ Notification                     PortfolioItem · SiteSetting · FaqItem · ContentPage · ContactMessage · WebhookEvent
```

- **Order** iki türdür: `PURCHASE` (paket satın alma + ilk şarkı) ve `ENTITLEMENT` (mevcut paket hakkından yeni şarkı). Her sipariş, sipariş anındaki paket koşullarını `packageSnapshot` olarak saklar; fiyat sonradan değişse de sipariş korunur.
- **PackageEntitlement** yalnızca başarılı ve doğrulanmış ödemeyle oluşur (`sourceOrderId` ve `paymentId` benzersiz → bir ödeme/sipariş için tek hak). `usedVideos` koşullu artırımla (`usedVideos <= total - n`) güncellenir; eşzamanlı isteklerde haklar aşılamaz.
- **Project** = tek video işi. Siparişteki video adedi kadar oluşturulur; teslim tarihleri aylık plana göre otomatik atanır.
- **Deliverable** editörün yüklediği sürümdür; `releasedAt` dolana kadar müşteriye görünmez.

## Sipariş durumları

`PAYMENT_PENDING → NEW / AWAITING_FILES → ASSIGNED → IN_PROGRESS → IN_REVIEW → READY_FOR_DELIVERY → DELIVERED · CANCELLED`

Geçiş kuralları `src/lib/order-status.ts` içindedir. Ödeme bekleyen bir sipariş elle "ödendi" yapılamaz. Sistem geçişleri: ödeme onayı ve dosyaların tamamlanması (`AWAITING_FILES → NEW`). Paketlerde revizyon hakkı yoktur; `DELIVERED` son durumdur. Teslim edilmeden iptal edilen siparişin video hakları pakete iade edilir.

**Üretim öncesi sorular:** Ekip, sipariş sayfasından müşteriye soru/not gönderir (`OrderEvent` tipi `NOTE`, e-posta ile de iletilir); müşteri sipariş sayfasından yanıtlar (`CUSTOMER_MESSAGE`, ekibe bildirim düşer). Mesajlar müşteri panelinde ayrı bir sohbet alanında, yönetim panelinde sipariş geçmişinde görünür.

## Aylık teslim planı

`src/lib/delivery-plan.ts`: Paketler paket süresi boyunca aylık toplu olarak teslim edilir (30 / 30 / 45 — bonus son teslimde). Ödeme Türkiye saatiyle ayın 1–15'i arasındaysa ilk teslim 5 iş günü içinde (hafta sonu ve sabit resmî tatiller hariç; dini bayramlar listede yok), 16'sı ve sonrasındaysa izleyen ayın 1'indedir; sonraki teslimler her ayın 1'indedir (`deliveryDates`). Paket içindeki her video, sırasına göre bir teslim tarihine düşer; proje ve sipariş teslim tarihleri buna göre atanır ve müşteri panelinde takvim olarak görünür.

## Ödeme akışı

Ortak arayüz: `src/server/payments/types.ts` (`PaymentGateway`). Sağlayıcı `PAYMENT_PROVIDER` ile seçilir; anahtarları eksikse `activeProviderId()` null döner ve satış kapanır.

1. **Sipariş**: Sunucu fiyatı paketten okur (istemciden gelen tutar kullanılmaz), `PAYMENT_PENDING` sipariş oluşur.
2. **Başlatma** (`startPayment`): Fatura bilgileri ve mesafeli satış onayı alınır, `Payment(PENDING)` oluşur, sağlayıcının barındırılan ödeme sayfasına yönlendirilir. Kart bilgisi sitemize hiç gelmez.
3. **Doğrulama**: Dönüş (callback) veya webhook geldiğinde sonuç sağlayıcıdan **sunucu-sunucu** sorgulanır (`confirmByToken`). `applyVerifiedResult` tutarı, para birimini, conversationId'yi ve sipariş numarasını kendi kaydıyla karşılaştırır; uyuşmazlıkta hak tanımlanmaz ve ekibe uyarı gider.
4. **Tanımlama** (`finalizeSuccessfulPayment`): Ödeme durumu koşullu güncellemeyle (`status IN (PENDING, FAILED, CANCELLED)`) talep edilir → aynı bildirim iki kez gelse de hak bir kez oluşur. Paket hakkı, video işleri ve teslim tarihleri aynı transaction içinde oluşturulur.
5. **İade**: `markPaymentRefunded` ödemeyi `REFUNDED` yapar ve hakkı `REVOKED` eder (yeni sipariş açılamaz). Para iadesi sağlayıcı panelinden yapılır.

Webhook olayları `WebhookEvent(provider, eventKey)` benzersiz anahtarıyla kaydedilir; işlenmiş olay tekrar işlenmez.

### iyzico
- Checkout Form: `/payment/iyzipos/checkoutform/initialize/auth/ecom` → `paymentPageUrl`; sonuç: `/payment/iyzipos/checkoutform/auth/ecom/detail`.
- Kimlik doğrulama IYZWSv2 (HMAC-SHA256). Taksit kapalıdır (`enabledInstallments: [1]`) — ödenen tutar paket fiyatına eşittir.
- Webhook imzası `X-IYZ-SIGNATURE-V3` = hex(HMAC-SHA256(secretKey, secretKey + iyziEventType + iyziPaymentId + token + paymentConversationId + status)).

### Shopify (isteğe bağlı)
Shopify zorunlu değildir; yapılandırılmadığında hiçbir Shopify çağrısı yapılmaz.

- **Ürün eşlemesi**: `PackageChannelListing` her paketi bir Shopify ürün/varyant GID'ine bağlar. Admin "Fiyatı Shopify'dan doğrula" ile varyant fiyatını Storefront API'den okur; fiyat AddLyrics fiyatıyla birebir eşleşmezse paket Shopify üzerinden satılamaz.
- **Ödeme**: Storefront API `cartCreate` ile sepet oluşturulur; sepete `addlyrics_payment` (Payment.conversationId) ve `addlyrics_order` (sipariş no) özellikleri yazılır. Sepet tutarı doğrulanır, müşteri `checkoutUrl`'e yönlenir.
- **Doğrulama**: `orders/paid` webhook'u HMAC (`X-Shopify-Hmac-Sha256`) ve mağaza alan adıyla doğrulanır. `SHOPIFY_ADMIN_ACCESS_TOKEN` varsa sipariş Admin API'den yeniden okunur. Varyant, tutar ve para birimi eşleşirse aynı `finalizeSuccessfulPayment` akışı çalışır. Shopify sipariş GID'i `Payment.providerPaymentId`, sipariş adı `providerReference` olarak saklanır; Shopify müşterisi `ExternalCustomer` ile eşlenir.
- **İade/iptal**: `refunds/create`, `orders/cancelled` → ödeme tamamen iade/iptal edildiyse hak kapanır; kısmi iadede ekibe uyarı gider.
- Shopify ödeme sayfasından sonra müşteriyi siteye döndürmek için Shopify'da sipariş durumu sayfasına `APP_URL/panel/siparislerim` bağlantısı eklenebilir; sonuç sayfası webhook gelene kadar "doğrulanıyor" gösterir.

## Dosya yükleme

1. `POST /api/uploads` → tür/uzantı/MIME/boyut kontrolü, sahiplik kontrolü, `UploadedFile(PENDING)`, imzalı hedef.
2. Tarayıcı dosyayı doğrudan hedefe `PUT` eder (ilerleme çubuğu): yerelde `/api/uploads/:id/content` (kısa ömürlü HMAC belirteci başlıkta), S3/R2'de imzalı URL (boyut imzaya dahil).
3. `POST /api/uploads/:id/complete` → gerçek boyut ve **içerik imzası (magic bytes)** doğrulanır; uyuşmazsa dosya silinir.
4. İndirme `GET /api/files/:id`: müşteri yalnızca kendi dosyalarını ve **yayınlanmış** teslimlerini indirebilir (diğer durumlarda 404). Video oynatma için Range desteği vardır. Portfolyo medyası yalnızca yayındaki öğelere bağlıysa `/api/media/:id` ile açıktır.

## Güvenlik

- Oturum: 32 baytlık rastgele belirteç, veritabanında yalnızca SHA-256 özeti; `HttpOnly`, `SameSite=Lax`, üretimde `__Host-` + `Secure`. Şifreler Argon2id.
- Yetki: Her sayfa, sunucu eylemi ve API rotası oturumu kendisi doğrular (`requireUser` / `requireAdmin`). Müşteri sorguları `userId` ile sınırlıdır (`src/server/queries/customer.ts`). Yönetim alanı yetki kontrolünden önce hiçbir içerik göndermez (gerçek 404). `proxy.ts` yalnızca iyimser yönlendirme yapar.
- CSRF: Sunucu eylemleri Next.js köken denetimine, API rotaları `isSameOrigin` kontrolüne tabidir.
- Hız sınırlama: giriş, kayıt, şifre sıfırlama, yükleme, sipariş, ödeme, iletişim, webhook (`src/server/rate-limit.ts`, bellek içi — çok sunuculu kurulumda Redis'e taşınmalı).
- Güvenlik başlıkları ve CSP: `next.config.ts` (yalnızca `www.tiktok.com` iframe'e izinli).
- Kart verisi saklanmaz; sağlayıcı sonuçlarından yalnızca kart içermeyen özet tutulur.

## Önbellek (Cache Components)

Herkese açık içerik (`src/server/queries/public.ts`) `'use cache'` + `cacheTag` ile önbelleğe alınır; admin değişikliklerinde `updateTag` ile anında yenilenir. Oturum okuyan bileşenler `<Suspense>` içindedir. Not: `next build` sırasında veritabanına erişim gerekir (statik kabuk için).

## Çok dillilik (i18n)

- Arayüz metinleri `src/i18n/tr.ts`; dil yapılandırması `src/i18n/config.ts`.
- İçerik tabloları (`SiteSetting`, `FaqItem`, `ContentPage`) `locale` alanına sahiptir.
- İngilizce eklemek için: `src/i18n/en.ts` oluşturun, `locales` dizisine ekleyin, `/en` önekli rotalar için `src/app/[lang]` yapısına geçin (Next.js `internationalization` rehberi) ve içerikleri `locale="en"` ile girin. Yönetim paneli metinleri şimdilik yalnızca Türkçedir.

## Ücretsiz deneme, doğrulama, iş ortaklığı ve duyurular

Ekim 2026'da eklendi; ayrıntılı kurallar ve uçtan uca akışlar: [DENEME-VE-ORTAKLIK.md](DENEME-VE-ORTAKLIK.md).

- Modeller: `PhoneAccountSlot` (telefon başına 2 hesap, CHECK + benzersiz kısıt), `VerificationCode`, `TrialApplication` → `TrialVideo` ×3 → `TrialEvent`, `Partner` → `ReferralCode` → `Commission` → `CommissionPayout`, `Announcement`, `AuditLog`. `Order` üzerinde `listPriceKurus`, `discountKurus`, `referralCodeId`, `partnerId`, `trialApplicationId`; `Project.trialVideoId` (deneme videosunun ücretli teslime dönüşümü); `Package.trialCountsTowardPackage` / `trialConversionBusinessDays`.
- Servisler: `src/server/domain/trials.ts`, `referrals.ts`, `announcements.ts`, `src/server/verification/*`, `src/server/video/ffmpeg.ts`, `src/server/media-sign.ts`, `src/server/audit.ts`, `src/server/system-settings.ts`.
- Ödeme onayı (`finalizeSuccessfulPayment`) tek işlemde: deneme dönüşümü (benzersiz `convertedOrderId`), projeler, teslim kayıtları, paket hakkı ve komisyon. Tekrarlanan bildirimler hiçbir kaydı ikinci kez oluşturmaz.
- Ön izleme medyası `/api/deneme-medya/{video}/{preview|poster}?t=…` (20 dk imzalı + oturum kontrolü). Ana dosya yalnızca ödeme sonrası yayınlanmış teslim olarak `/api/files` üzerinden açılır.
- İş ortağı alanı (`/ortak`) yönetim paneli gibi engelleyici yetki katmanıyla korunur (yetkisiz → 404).

## Editör paneline geçiş (ileride)

İlk sürümde editörler giriş yapmaz. Geçiş için: editöre `Role.EDITOR` hesabı açın ve `Editor.userId` ile bağlayın; `/editor` alanında yalnızca `EditorAssignment(active, editor.userId = oturum)` siparişlerini listeleyin; `addDeliverable` yetkisini atanmış editöre açın, `releaseDeliverable` (müşteriye teslim) yetkisini admin'de bırakın.
