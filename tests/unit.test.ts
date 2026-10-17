import { FileKind, FootageSource, OrderStatus, Platform, ReleaseStatus, VideoFormat, VideoStyle } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { FILE_KINDS, FOOTAGE_SOURCES, ORDER_STATUSES, PLATFORMS, RELEASE_STATUSES, VIDEO_FORMATS, VIDEO_STYLES } from "@/lib/enums";
import { parseTikTokUrl } from "@/lib/embeds";
import { decimalToKurus, formatMoney, kurusToDecimalString, parseMoneyToKurus } from "@/lib/money";
import { missingRequiredItems } from "@/lib/order-requirements";
import { allowedTransitions, canTransition } from "@/lib/order-status";
import { addMonths, comparePackages, missingSaleFields, perVideoKurus, saleState, type PackageLike } from "@/lib/packages";
import { slugify } from "@/lib/slug";
import { iyzicoAuthHeaders, verifyIyzicoWebhookSignature } from "@/server/payments/iyzico";
import { parseShopifyOrderPayload, verifyShopifyWebhook } from "@/server/payments/shopify";
import { contentDisposition, matchesSignature, safeDownloadName, validateDeclaredFile } from "@/server/storage/file-rules";
import { parseRange } from "@/server/storage/local";
import { createHmac } from "node:crypto";

const pkg = (over: Partial<PackageLike> = {}): PackageLike => ({
  id: "p1",
  slug: "p1",
  name: "P1",
  durationMonths: 1,
  priceKurus: 320000,
  currency: "TRY",
  videoCount: 30,
  bonusVideoCount: 0,
  deliveryTerms: "Her ayın 1'i",
  deliveryDays: null,
  includedFormats: ["VERTICAL"],
  includedStyles: ["MINIMAL"],
  status: "PUBLISHED",
  isSample: false,
  ...over,
});

describe("para", () => {
  it("kuruş dönüşümleri", () => {
    expect(parseMoneyToKurus("3.200")).toBe(320000); // binlik ayırıcı
    expect(parseMoneyToKurus("1.5")).toBe(150); // ondalık
    expect(parseMoneyToKurus("3200")).toBe(320000);
    expect(parseMoneyToKurus("3.200,50")).toBe(320050);
    expect(parseMoneyToKurus("9400,00 TL")).toBe(940000);
    expect(parseMoneyToKurus("abc")).toBeNull();
    expect(kurusToDecimalString(320050)).toBe("3200.50");
    expect(decimalToKurus("3200.5")).toBe(320050);
    expect(decimalToKurus("89.524")).toBe(8952);
    expect(formatMoney(320000)).toMatch(/3\.200,00/);
  });
});

describe("paket kuralları", () => {
  it("eksik alanları bulur ve satışı engeller", () => {
    expect(missingSaleFields(pkg({ priceKurus: null, deliveryTerms: null }))).toEqual(["price", "deliveryTerms"]);
    expect(saleState(pkg({ priceKurus: null }), { allowSamplePackages: true, paymentsAvailable: true })).toEqual({ purchasable: false, reason: "incomplete" });
    expect(saleState(pkg({ status: "DRAFT" }), { allowSamplePackages: true, paymentsAvailable: true })).toEqual({ purchasable: false, reason: "not_published" });
    expect(saleState(pkg({ isSample: true }), { allowSamplePackages: false, paymentsAvailable: true })).toEqual({ purchasable: false, reason: "sample" });
    expect(saleState(pkg(), { allowSamplePackages: false, paymentsAvailable: false })).toEqual({ purchasable: false, reason: "payments_unavailable" });
    expect(saleState(pkg(), { allowSamplePackages: false, paymentsAvailable: true })).toEqual({ purchasable: true });
  });

  it("video başına maliyet bonus dahil hesaplanır, tasarruf yalnızca gerçek fiyatlardan", () => {
    const one = pkg({ id: "a", durationMonths: 1, priceKurus: 320000, videoCount: 30 });
    const two = pkg({ id: "b", durationMonths: 2, priceKurus: 620000, videoCount: 60 });
    const three = pkg({ id: "c", durationMonths: 3, priceKurus: 940000, videoCount: 90, bonusVideoCount: 15 });
    expect(perVideoKurus(three)).toBe(Math.round(940000 / 105));
    const cmp = comparePackages([one, two, three]);
    expect(cmp.map((c) => c.savingsPercent)).toEqual([null, 3, 16]);
    // Fiyatı olmayan paket karşılaştırmaya girmez
    expect(comparePackages([one, pkg({ id: "x", priceKurus: null })])[1]!.savingsPercent).toBeNull();
  });

  it("ay ekleme ay sonu taşmalarını düzeltir", () => {
    expect(addMonths(new Date(Date.UTC(2026, 0, 31)), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(addMonths(new Date(Date.UTC(2026, 9, 17)), 3).toISOString().slice(0, 10)).toBe("2027-01-17");
  });
});

describe("sipariş durum makinesi", () => {
  it("geçişleri kısıtlar", () => {
    expect(canTransition("PAYMENT_PENDING", "NEW")).toBe(false);
    expect(canTransition("PAYMENT_PENDING", "NEW", "system")).toBe(true);
    expect(canTransition("NEW", "ASSIGNED")).toBe(true);
    expect(canTransition("CANCELLED", "NEW")).toBe(false);
    // Revizyon hakkı yok: teslim edilen sipariş son durumdur
    expect(allowedTransitions("DELIVERED")).toEqual([]);
    expect(allowedTransitions("DELIVERED", "system")).toEqual([]);
  });

  it("zorunlu dosyaları belirler", () => {
    expect(missingRequiredItems({ style: "MINIMAL", footageSource: null, lyricsText: "söz", fileKinds: ["SONG_AUDIO"] })).toEqual([]);
    expect(missingRequiredItems({ style: "MUSIC_VIDEO", footageSource: null, lyricsText: "", fileKinds: [] })).toEqual(["SONG_AUDIO", "LYRICS", "MUSIC_VIDEO"]);
    expect(missingRequiredItems({ style: "FILM_EDIT", footageSource: "CUSTOMER_PROVIDED", lyricsText: "x", fileKinds: ["SONG_AUDIO"] })).toEqual(["FOOTAGE"]);
  });
});

describe("iyzico imzaları", () => {
  it("IYZWSv2 yetki başlığı", () => {
    const h = iyzicoAuthHeaders("api", "secret", "/path", "{}", "123");
    const decoded = Buffer.from(h.Authorization.replace("IYZWSv2 ", ""), "base64").toString();
    const sig = createHmac("sha256", "secret").update("123/path{}").digest("hex");
    expect(decoded).toBe(`apiKey:api&randomKey:123&signature:${sig}`);
    expect(h["x-iyzi-rnd"]).toBe("123");
  });

  it("webhook imzası (X-IYZ-SIGNATURE-V3, Checkout Form)", () => {
    const body = { iyziEventType: "CHECKOUT_FORM_AUTH", iyziPaymentId: "123", token: "tok", paymentConversationId: "conv", status: "SUCCESS" };
    const sig = createHmac("sha256", "secret").update("secretCHECKOUT_FORM_AUTH123tokconvSUCCESS").digest("hex");
    expect(verifyIyzicoWebhookSignature(body, sig, "secret")).toBe(true);
    expect(verifyIyzicoWebhookSignature(body, sig.toUpperCase(), "secret")).toBe(true);
    expect(verifyIyzicoWebhookSignature({ ...body, status: "FAILURE" }, sig, "secret")).toBe(false);
    expect(verifyIyzicoWebhookSignature(body, null, "secret")).toBe(false);
  });
});

describe("Shopify", () => {
  it("webhook HMAC doğrulaması", () => {
    const raw = JSON.stringify({ id: 1 });
    const hmac = createHmac("sha256", "whsec").update(raw).digest("base64");
    expect(verifyShopifyWebhook(raw, hmac, "whsec")).toBe(true);
    expect(verifyShopifyWebhook(raw + " ", hmac, "whsec")).toBe(false);
    expect(verifyShopifyWebhook(raw, hmac, undefined)).toBe(false);
  });

  it("sipariş gövdesini ortak görünüme çevirir", () => {
    const view = parseShopifyOrderPayload({
      id: 55,
      name: "#1001",
      financial_status: "paid",
      currency: "TRY",
      current_total_price: "9400.00",
      note_attributes: [{ name: "addlyrics_payment", value: "alp_x" }],
      line_items: [{ variant_id: 77, quantity: 1 }],
      customer: { id: 9 },
    });
    expect(view).toMatchObject({
      gid: "gid://shopify/Order/55",
      totalKurus: 940000,
      financialStatus: "paid",
      attributes: { addlyrics_payment: "alp_x" },
      variantGids: ["gid://shopify/ProductVariant/77"],
      customerGid: "gid://shopify/Customer/9",
    });
  });
});

describe("dosya kuralları", () => {
  it("Türkçe dosya adları indirme başlığını bozmaz; özgün ad UTF-8 olarak korunur", () => {
    const name = "Önizleme ılık şarkı (Çığ) 'İlk'.mp4";
    const value = contentDisposition(name, true);
    // HTTP başlıkları yalnızca ASCII taşıyabilir; aksi halde yanıt oluşturulurken hata fırlatılır
    expect(() => new Headers({ "Content-Disposition": value })).not.toThrow();
    expect(value).toMatch(/^[\x20-\x7e]+$/);
    expect(value).toContain(`filename="Onizleme ilik sarki (Cig) 'Ilk'.mp4"`);
    const star = value.split("filename*=UTF-8''")[1]!;
    expect(star).not.toMatch(/['()*]/);
    expect(decodeURIComponent(star)).toBe(name);
    expect(contentDisposition("a.mp4", false)).toMatch(/^attachment; /);
    expect(safeDownloadName('kötü"ad\r\n/x;y.mp3')).toBe("kotu_ad___x_y.mp3");
    expect(safeDownloadName("日本")).toBe("__");
    expect(safeDownloadName("   ")).toBe("dosya");
  });

  it("uzantı, MIME ve boyut", () => {
    expect(validateDeclaredFile("SONG_AUDIO", "sarki.mp3", "audio/mpeg", 1000).ok).toBe(true);
    expect(validateDeclaredFile("SONG_AUDIO", "sarki.exe", "audio/mpeg", 1000).ok).toBe(false);
    expect(validateDeclaredFile("SONG_AUDIO", "sarki.mp3", "application/x-msdownload", 1000).ok).toBe(false);
    expect(validateDeclaredFile("IMAGE", "a.png", "image/png", 999 * 1024 * 1024).ok).toBe(false);
  });

  it("içerik imzası", () => {
    expect(matchesSignature("SONG_AUDIO", Buffer.from("ID3\x03\x00", "latin1"))).toBe(true);
    expect(matchesSignature("IMAGE", Buffer.from("not an image"))).toBe(false);
    const mp4 = Buffer.alloc(16);
    mp4.write("ftyp", 4, "latin1");
    expect(matchesSignature("MUSIC_VIDEO", mp4)).toBe(true);
  });

  it("Range başlığı", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=900-", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=2000-", 1000)).toBe("invalid");
    expect(parseRange(null, 1000)).toBeNull();
  });
});

describe("yardımcılar", () => {
  it("slug ve TikTok bağlantıları", () => {
    expect(slugify("3 Aylık Paket")).toBe("3-aylik-paket");
    expect(slugify("Şarkı Ğüzel İçerik")).toBe("sarki-guzel-icerik");
    expect(parseTikTokUrl("https://www.tiktok.com/@pluxer6/video/7697345731677457684?_r=1")).toMatchObject({
      id: "7697345731677457684",
      handle: "pluxer6",
    });
    expect(parseTikTokUrl("https://example.com/video/1")).toBeNull();
  });

  it("istemci enum'ları veritabanı şemasıyla aynı", () => {
    const values = (e: Record<string, string>) => Object.values(e).sort();
    expect([...VIDEO_STYLES].sort()).toEqual(values(VideoStyle));
    expect([...VIDEO_FORMATS].sort()).toEqual(values(VideoFormat));
    expect([...PLATFORMS].sort()).toEqual(values(Platform));
    expect([...RELEASE_STATUSES].sort()).toEqual(values(ReleaseStatus));
    expect([...FOOTAGE_SOURCES].sort()).toEqual(values(FootageSource));
    expect([...ORDER_STATUSES].sort()).toEqual(values(OrderStatus));
    expect([...FILE_KINDS].sort()).toEqual(values(FileKind));
  });
});
