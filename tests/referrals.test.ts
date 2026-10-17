import { beforeEach, describe, expect, it } from "vitest";
import { computeCommission, computeDiscount } from "@/lib/referral";
import { db } from "@/server/db";
import { createPurchaseOrder } from "@/server/domain/orders";
import {
  applyReferralCodeToOrder,
  approveCommission,
  createPartner,
  createReferralCode,
  previewReferralCode,
  recordCommissionPayout,
  updateReferralCode,
  type ReferralCodeInput,
} from "@/server/domain/referrals";
import { confirmByToken, markPaymentRefunded, startPayment } from "@/server/payments/service";
import { getPartnerDashboard } from "@/server/queries/partner";
import { billing, createPackage, createUser, orderInput, resetDb, sessionOf, uploadedFile } from "./helpers";

async function setup() {
  const admin = sessionOf(await createUser("ADMIN"));
  const partner = await createPartner(admin, { name: "Rap Sayfası", email: "ortak@test.local", phone: null, socialAccounts: [], notes: null, active: true });
  const pkg = await createPackage({ priceKurus: 320000, videoCount: 30 });
  const codeInput: ReferralCodeInput = {
    code: "RAP10",
    partnerId: partner.id,
    discountType: "PERCENT",
    discountValue: 1000,
    commissionRateBps: 1500,
    commissionBase: "PAID_AMOUNT",
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    active: true,
    packageIds: [],
  };
  const code = await createReferralCode(admin, codeInput);
  return { admin, partner, pkg, code, codeInput };
}

async function orderWithCode(pkgSlug: string, code: string) {
  const user = await createUser();
  const audio = await uploadedFile(user.id, "SONG_AUDIO");
  const order = await createPurchaseOrder(user.id, pkgSlug, orderInput({ fileIds: [audio.id] }));
  const applied = await applyReferralCodeToOrder(user.id, order.number, code);
  return { user, order, applied };
}

async function pay(orderNumber: string, userId: string) {
  const started = await startPayment(orderNumber, userId, billing, "127.0.0.1");
  const payment = await db.payment.update({ where: { id: started.paymentId }, data: { mockOutcome: "success" } });
  await confirmByToken("MOCK", payment.providerToken!);
  return payment;
}

describe("indirim ve komisyon hesabı", () => {
  it("yüzde ve sabit indirim; sipariş bedelsiz hale getirilemez", () => {
    expect(computeDiscount(320000, "PERCENT", 1000)).toBe(32000);
    expect(computeDiscount(320000, "FIXED", 50000)).toBe(50000);
    expect(computeDiscount(320000, "FIXED", 999999)).toBe(320000 - 100);
  });

  it("komisyon tabanı yöneticinin seçtiği tutara göre hesaplanır", () => {
    const base = { rateBps: 1000, listPriceKurus: 320000, discountKurus: 32000, paidKurus: 288000, vatRatePercent: 20 };
    expect(computeCommission({ ...base, baseType: "LIST_PRICE" }).amountKurus).toBe(32000);
    expect(computeCommission({ ...base, baseType: "PAID_AMOUNT" }).amountKurus).toBe(28800);
    expect(computeCommission({ ...base, baseType: "PAID_AMOUNT_EXCL_VAT" }).baseAmountKurus).toBe(240000);
    expect(computeCommission({ ...base, baseType: "PAID_AMOUNT_EXCL_VAT" }).amountKurus).toBe(24000);
  });
});

describe("referans kodları ve komisyonlar", () => {
  beforeEach(resetDb);

  it("referans kodunu yalnızca yönetici oluşturup düzenleyebilir", async () => {
    const { partner, code, codeInput } = await setup();
    const customer = sessionOf(await createUser());
    const partnerUser = sessionOf(await createUser("PARTNER"));
    for (const actor of [customer, partnerUser]) {
      await expect(createReferralCode(actor, { ...codeInput, code: "KENDIM50", partnerId: partner.id })).rejects.toThrow(/yönetici/);
      await expect(updateReferralCode(actor, code.id, { ...codeInput, commissionRateBps: 9000 })).rejects.toThrow(/yönetici/);
    }
    expect(await db.referralCode.count()).toBe(1);
    expect((await db.referralCode.findUniqueOrThrow({ where: { id: code.id } })).commissionRateBps).toBe(1500);
  });

  it("kodlar benzersizdir ve büyük harfe çevrilir", async () => {
    const { admin, codeInput } = await setup();
    await expect(createReferralCode(admin, { ...codeInput, code: "rap10" })).rejects.toThrow(/zaten/);
  });

  it("kodla gelen satış doğru iş ortağına bağlanır; komisyon yalnızca doğrulanmış ödemede doğar", async () => {
    const { pkg, partner, code } = await setup();
    const { user, order, applied } = await orderWithCode(pkg.slug, "rap10");
    expect(applied.discountKurus).toBe(32000);
    const pending = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(pending.priceKurus).toBe(288000);
    expect(pending.partnerId).toBe(partner.id);
    expect(await db.commission.count()).toBe(0); // ödeme yokken kazanılmış satış yok

    const payment = await pay(order.number, user.id);
    expect(payment.amountKurus).toBe(288000);
    const commission = await db.commission.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(commission.partnerId).toBe(partner.id);
    expect(commission.referralCodeId).toBe(code.id);
    expect(commission.status).toBe("PENDING");
    expect(commission.amountKurus).toBe(43200); // %15 × 2.880 TL
    expect((await db.referralCode.findUniqueOrThrow({ where: { id: code.id } })).usageCount).toBe(1);

    // Aynı bildirim tekrar gelir: ikinci komisyon/kullanım oluşmaz
    await confirmByToken("MOCK", payment.providerToken!);
    expect(await db.commission.count()).toBe(1);
    expect((await db.referralCode.findUniqueOrThrow({ where: { id: code.id } })).usageCount).toBe(1);
  });

  it("iade, ödenmemiş komisyonu iptal eder; ödenmiş komisyon sonraki ödemeden mahsup edilir", async () => {
    const { admin, pkg, partner } = await setup();
    const first = await orderWithCode(pkg.slug, "RAP10");
    const p1 = await pay(first.order.number, first.user.id);
    await markPaymentRefunded(p1.id, admin.id, "Müşteri talebi");
    const c1 = await db.commission.findUniqueOrThrow({ where: { orderId: first.order.id } });
    expect(c1.status).toBe("CANCELLED");
    await expect(approveCommission(admin, c1.id)).rejects.toThrow();

    // Ödenmiş komisyon sonra iade edilirse
    const second = await orderWithCode(pkg.slug, "RAP10");
    const p2 = await pay(second.order.number, second.user.id);
    const c2 = await db.commission.findUniqueOrThrow({ where: { orderId: second.order.id } });
    await expect(approveCommission(admin, c2.id)).rejects.toThrow(/cayma süresi/); // bekleme süresi dolmadı
    await db.commission.update({ where: { id: c2.id }, data: { eligibleAt: new Date(Date.now() - 1000) } });
    await approveCommission(admin, c2.id);
    await recordCommissionPayout(admin, { partnerId: partner.id, commissionIds: [c2.id], method: "Havale", paidAt: new Date() });
    await markPaymentRefunded(p2.id, admin.id, "Ödeme sonrası iade");
    const c2After = await db.commission.findUniqueOrThrow({ where: { id: c2.id } });
    expect(c2After.status).toBe("PAID");
    expect(c2After.clawbackAt).not.toBeNull();

    // Sonraki ödemede mahsup edilir
    const third = await orderWithCode(pkg.slug, "RAP10");
    await pay(third.order.number, third.user.id);
    const c3 = await db.commission.findUniqueOrThrow({ where: { orderId: third.order.id } });
    await db.commission.update({ where: { id: c3.id }, data: { eligibleAt: new Date(Date.now() - 1000) } });
    await approveCommission(admin, c3.id);
    await expect(recordCommissionPayout(admin, { partnerId: partner.id, commissionIds: [c3.id], method: "Havale", paidAt: new Date() })).rejects.toThrow(/aşıyor/);
    const audits = await db.auditLog.count({ where: { action: "commission.payout" } });
    expect(audits).toBe(1);
  });

  it("iş ortağı yalnızca kendi verilerini görür; müşteri adı maskelenir", async () => {
    const { admin, pkg, partner } = await setup();
    const other = await createPartner(admin, { name: "Diğer Sayfa", email: null, phone: null, socialAccounts: [], notes: null, active: true });
    await createReferralCode(admin, {
      code: "DIGER5",
      partnerId: other.id,
      discountType: "PERCENT",
      discountValue: 500,
      commissionRateBps: 1000,
      commissionBase: "LIST_PRICE",
      startsAt: null,
      endsAt: null,
      usageLimit: null,
      active: true,
      packageIds: [],
    });
    const a = await orderWithCode(pkg.slug, "RAP10");
    await pay(a.order.number, a.user.id);
    const b = await orderWithCode(pkg.slug, "DIGER5");
    await pay(b.order.number, b.user.id);

    const mine = await getPartnerDashboard(partner.id);
    expect(mine.codes.map((c) => c.code)).toEqual(["RAP10"]);
    expect(mine.commissions).toHaveLength(1);
    expect(mine.commissions[0]!.order.number).toBe(a.order.number);
    expect(mine.commissions[0]!.order.customer).toMatch(/^\S\*\*\*/);
    expect(JSON.stringify(mine)).not.toContain(a.user.email);
    expect(JSON.stringify(mine)).not.toContain(b.order.number);
  });

  it("süresi dolmuş, pasif veya başka pakete ait kod uygulanamaz", async () => {
    const { admin, pkg, code, codeInput } = await setup();
    const other = await createPackage();
    const user = await createUser();
    const order = await createPurchaseOrder(user.id, pkg.slug, orderInput({ fileIds: [] }));
    await updateReferralCode(admin, code.id, { ...codeInput, endsAt: new Date(Date.now() - 1000) });
    await expect(applyReferralCodeToOrder(user.id, order.number, "RAP10")).rejects.toThrow(/süresi/);
    await updateReferralCode(admin, code.id, { ...codeInput, packageIds: [other.id] });
    await expect(applyReferralCodeToOrder(user.id, order.number, "RAP10")).rejects.toThrow(/pakette/);
    await updateReferralCode(admin, code.id, { ...codeInput, active: false });
    await expect(applyReferralCodeToOrder(user.id, order.number, "RAP10")).rejects.toThrow(/geçerli değil/);
  });

  it("sipariş özetindeki kod önizlemesi indirimi hesaplar ama hiçbir kaydı değiştirmez", async () => {
    const { admin, partner, pkg, code, codeInput } = await setup();
    const user = await createUser();
    const preview = await previewReferralCode(user.id, pkg.slug, " rap10 ");
    expect(preview).toMatchObject({ code: "RAP10", listPriceKurus: 320000, discountKurus: 32000, priceKurus: 288000 });
    expect(await db.order.count({ where: { userId: user.id } })).toBe(0);
    expect((await db.referralCode.findUniqueOrThrow({ where: { id: code.id } })).usageCount).toBe(0);

    await expect(previewReferralCode(user.id, pkg.slug, "YOKBOYLE")).rejects.toThrow(/bulunamadı/);
    // İş ortağı kendi koduyla indirim alamaz
    const partnerUser = await createUser("PARTNER");
    await db.partner.update({ where: { id: partner.id }, data: { userId: partnerUser.id } });
    await expect(previewReferralCode(partnerUser.id, pkg.slug, "RAP10")).rejects.toThrow(/Kendi/);
    await updateReferralCode(admin, code.id, { ...codeInput, active: false });
    await expect(previewReferralCode(user.id, pkg.slug, "RAP10")).rejects.toThrow(/geçerli değil/);
  });
});
