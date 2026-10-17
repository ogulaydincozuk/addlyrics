import "server-only";
import { CONTENT_PAGE_SLUGS, DEFAULT_SETTINGS, SETTING_SCHEMAS } from "@/content/settings";
import { db } from "./db";
import { packageSaleState } from "./domain/packages";
import { env, s3Configured, smtpConfigured } from "./env";
import { activeProviderId } from "./payments/config";

export type ReadinessItem = { key: string; label: string; ok: boolean; detail: string; href?: string };

/**
 * Gerçek satışa başlamadan önce tamamlanması gerekenler. Gösterge panelinde listelenir;
 * böylece eksik yapılandırma "çalışıyormuş gibi" görünmez.
 */
export async function getReadiness(): Promise<ReadinessItem[]> {
  const e = env();
  const provider = activeProviderId();
  const [packages, legalPages, faqReview, contactRow, realPortfolio, activeEditors] = await Promise.all([
    db.package.findMany({ include: { channelListings: true } }),
    db.contentPage.findMany({ where: { isLegal: true, locale: "tr" }, select: { slug: true, reviewedAt: true } }),
    db.faqItem.count({ where: { published: true, needsReview: true } }),
    db.siteSetting.findUnique({ where: { key_locale: { key: "contact", locale: "tr" } } }),
    db.portfolioItem.count({ where: { published: true, isDemo: false } }),
    db.editor.count({ where: { active: true } }),
  ]);

  const hasSampleTerms = (p: (typeof packages)[number]) => Boolean(p.deliveryTerms?.includes("Örnek veri"));
  const sellable = packages.filter((p) => packageSaleState(p).purchasable && !p.isSample && !hasSampleTerms(p));
  const unpricedOrSample = packages.filter((p) => p.status === "PUBLISHED" && (p.isSample || p.priceKurus == null || hasSampleTerms(p)));
  const parsedContact = SETTING_SCHEMAS.contact.safeParse({ ...DEFAULT_SETTINGS.contact, ...((contactRow?.value as object) ?? {}) });
  const contact = parsedContact.success ? parsedContact.data : DEFAULT_SETTINGS.contact;
  const contactMissing = (["companyName", "email", "phone", "address", "mersisNo"] as const).filter((k) => !contact[k]);
  const legalUnreviewed = legalPages.filter((p) => !p.reviewedAt).length;
  const legalMissing = CONTENT_PAGE_SLUGS.filter((s) => s !== "hakkimizda" && !legalPages.some((p) => p.slug === s)).length;

  return [
    {
      key: "payments",
      label: "Ödeme altyapısı",
      ok: provider === "IYZICO" || provider === "SHOPIFY",
      detail:
        provider === "MOCK"
          ? "Test ödemesi açık — gerçek ödeme alınmıyor."
          : provider
            ? `${provider === "IYZICO" ? "iyzico" : "Shopify"} yapılandırıldı.`
            : "Gerçek bir ödeme sağlayıcısı yapılandırılmadı.",
      href: "/admin/entegrasyonlar",
    },
    {
      key: "packages",
      label: "Satışa hazır paket",
      ok: sellable.length > 0 && unpricedOrSample.length === 0,
      detail: sellable.length
        ? `${sellable.length} paket satışta.${unpricedOrSample.length ? ` ${unpricedOrSample.length} yayındaki pakette örnek koşul veya eksik fiyat var.` : ""}`
        : unpricedOrSample.length
          ? `${unpricedOrSample.length} paketin teslimat koşulları hâlâ örnek veri — gerçek koşulları girin.`
          : "Gerçek fiyatı ve koşulları girilmiş, yayında olan paket yok.",
      href: "/admin/paketler",
    },
    {
      key: "legal",
      label: "Hukuki metinler incelendi",
      ok: legalUnreviewed === 0 && legalMissing === 0,
      detail: legalUnreviewed ? `${legalUnreviewed} yasal metin taslak durumunda (hukuk danışmanı onayı bekliyor).` : "Tüm yasal metinler incelendi.",
      href: "/admin/sayfalar",
    },
    {
      key: "faq",
      label: "SSS cevapları doğrulandı",
      ok: faqReview === 0,
      detail: faqReview ? `${faqReview} cevap gerçek hizmet politikasıyla doğrulanmalı.` : "Tüm cevaplar doğrulandı.",
      href: "/admin/sss",
    },
    {
      key: "contact",
      label: "Şirket ve iletişim bilgileri",
      ok: contactMissing.length === 0,
      detail: contactMissing.length ? `Eksik: ${contactMissing.join(", ")} (mesafeli satış için zorunlu bilgiler).` : "Tamamlandı.",
      href: "/admin/icerik",
    },
    {
      key: "email",
      label: "E-posta gönderimi",
      ok: e.EMAIL_DRIVER === "smtp" && smtpConfigured(),
      detail: e.EMAIL_DRIVER === "smtp" ? (smtpConfigured() ? "SMTP yapılandırıldı." : "SMTP_HOST eksik.") : "E-postalar yalnızca sunucu konsoluna yazılıyor.",
      href: "/admin/entegrasyonlar",
    },
    {
      key: "storage",
      label: "Dosya depolama",
      ok: e.STORAGE_DRIVER === "s3" && s3Configured(),
      detail: e.STORAGE_DRIVER === "s3" ? (s3Configured() ? "S3 uyumlu depolama yapılandırıldı." : "S3 bilgileri eksik.") : "Yerel disk kullanılıyor (yalnızca tek sunucu / geliştirme).",
      href: "/admin/entegrasyonlar",
    },
    {
      key: "portfolio",
      label: "Gerçek video örnekleri",
      ok: realPortfolio > 0,
      detail: realPortfolio ? `${realPortfolio} gerçek örnek yayında.` : "Yayında yalnızca stil önizlemeleri var.",
      href: "/admin/portfolyo",
    },
    {
      key: "editors",
      label: "Aktif editör",
      ok: activeEditors > 0,
      detail: activeEditors ? `${activeEditors} aktif editör.` : "Sipariş atamak için en az bir editör ekleyin.",
      href: "/admin/editorler",
    },
    {
      key: "https",
      label: "Güvenli alan adı (HTTPS)",
      ok: e.APP_URL.startsWith("https://"),
      detail: e.APP_URL.startsWith("https://") ? e.APP_URL : `APP_URL şu an ${e.APP_URL}`,
    },
  ];
}
