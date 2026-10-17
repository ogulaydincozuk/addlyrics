import "server-only";
import type { CommissionBase, DiscountType, Prisma } from "@prisma/client";
import { formatMoney } from "@/lib/money";
import {
  codeAvailability,
  computeCommission,
  computeDiscount,
  isValidReferralCode,
  normalizeReferralCode,
} from "@/lib/referral";
import type { PackageSnapshot } from "@/lib/packages";
import { audit } from "../audit";
import type { SessionUser } from "../auth/session";
import { hashPassword } from "../auth/password";
import { randomToken, sha256Hex } from "../crypto";
import { db, type Tx } from "../db";
import { sendEmail } from "../email";
import { renderEmail } from "../email/templates";
import { appUrl } from "../env";
import { readSystemSetting } from "../system-settings";
import { DomainError, isUniqueViolation } from "./errors";

/** Referans kodu ve iş ortaklığı yönetimi yalnızca yöneticilere açıktır (sunucu tarafı kontrol). */
function assertAdmin(actor: Pick<SessionUser, "id" | "role"> | null | undefined): asserts actor is Pick<SessionUser, "id" | "role"> {
  if (!actor || actor.role !== "ADMIN") throw new DomainError("Bu işlem için yönetici yetkisi gerekir.", "FORBIDDEN");
}

// ───────────────────────────── İş ortakları ─────────────────────────────

export type PartnerInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  socialAccounts: Array<{ platform: string; handle: string }>;
  notes?: string | null;
  active: boolean;
};

export async function createPartner(actor: Pick<SessionUser, "id" | "role">, input: PartnerInput) {
  assertAdmin(actor);
  const partner = await db.partner.create({
    data: {
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      socialAccounts: input.socialAccounts as unknown as Prisma.InputJsonValue,
      notes: input.notes ?? null,
      active: input.active,
    },
  });
  await audit({ actorId: actor.id, action: "partner.create", entityType: "Partner", entityId: partner.id, summary: partner.name });
  return partner;
}

export async function updatePartner(actor: Pick<SessionUser, "id" | "role">, partnerId: string, input: PartnerInput) {
  assertAdmin(actor);
  const before = await db.partner.findUnique({ where: { id: partnerId } });
  if (!before) throw new DomainError("İş ortağı bulunamadı.", "NOT_FOUND");
  const partner = await db.partner.update({
    where: { id: partnerId },
    data: {
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      socialAccounts: input.socialAccounts as unknown as Prisma.InputJsonValue,
      notes: input.notes ?? null,
      active: input.active,
    },
  });
  // Pasif iş ortağının panel hesabı da kapatılır
  if (partner.userId) await db.user.update({ where: { id: partner.userId }, data: { disabledAt: partner.active ? null : new Date() } });
  await audit({
    actorId: actor.id,
    action: "partner.update",
    entityType: "Partner",
    entityId: partnerId,
    summary: partner.name,
    data: { activeBefore: before.active, activeAfter: partner.active },
  });
  return partner;
}

/**
 * İş ortağına panel girişi açar: PARTNER rolünde hesap oluşturur ve şifre belirleme bağlantısı gönderir.
 * Mevcut bir müşteri hesabının rolü değiştirilmez.
 */
export async function createPartnerLogin(actor: Pick<SessionUser, "id" | "role">, partnerId: string, emailInput: string) {
  assertAdmin(actor);
  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError("Geçerli bir e-posta adresi yazın.");
  const partner = await db.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new DomainError("İş ortağı bulunamadı.", "NOT_FOUND");
  if (partner.userId) throw new DomainError("Bu iş ortağının zaten panel hesabı var.");
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new DomainError("Bu e-posta başka bir hesapta kullanılıyor. İş ortağı için ayrı bir e-posta kullanın.");
  }
  const token = randomToken(32);
  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { email, name: partner.name, role: "PARTNER", passwordHash: await hashPassword(randomToken(24)), emailVerifiedAt: new Date() },
    });
    await tx.partner.update({ where: { id: partnerId }, data: { userId: u.id, email: partner.email ?? email } });
    await tx.passwordResetToken.create({ data: { userId: u.id, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) } });
    return u;
  });
  const sent = await sendEmail(
    renderEmail(email, "AddLyrics iş ortaklığı paneli", {
      heading: "İş ortaklığı panelin hazır",
      paragraphs: [
        `Merhaba ${partner.name},`,
        "AddLyrics iş ortaklığı panelinde referans kodunu, atfedilen satışları ve komisyon durumunu görebilirsin.",
        "Aşağıdaki bağlantıyla şifreni belirle. Bağlantı 72 saat geçerlidir.",
      ],
      cta: { label: "Şifremi belirle", href: appUrl(`/sifre-sifirla?token=${encodeURIComponent(token)}`) },
    }),
  );
  await audit({ actorId: actor.id, action: "partner.create_login", entityType: "Partner", entityId: partnerId, summary: email });
  return { userId: user.id, emailSent: sent };
}

// ───────────────────────────── Referans kodları ─────────────────────────────

export type ReferralCodeInput = {
  code: string;
  partnerId: string;
  discountType: DiscountType;
  discountValue: number;
  commissionRateBps: number;
  commissionBase: CommissionBase;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  active: boolean;
  packageIds: string[];
};

function validateCodeInput(input: ReferralCodeInput) {
  const code = normalizeReferralCode(input.code);
  if (!isValidReferralCode(code)) throw new DomainError("Kod 4–24 karakter olmalı; harf, rakam ve tire kullanılabilir.");
  if (input.discountType === "PERCENT" && (input.discountValue < 0 || input.discountValue > 9000)) {
    throw new DomainError("İndirim yüzdesi %0 ile %90 arasında olmalı.");
  }
  if (input.discountType === "FIXED" && input.discountValue < 0) throw new DomainError("İndirim tutarı negatif olamaz.");
  if (input.commissionRateBps < 0 || input.commissionRateBps > 10000) throw new DomainError("Komisyon oranı %0 ile %100 arasında olmalı.");
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw new DomainError("Bitiş tarihi başlangıçtan sonra olmalı.");
  if (input.usageLimit != null && input.usageLimit < 1) throw new DomainError("Kullanım limiti en az 1 olmalı.");
  return code;
}

export async function createReferralCode(actor: Pick<SessionUser, "id" | "role">, input: ReferralCodeInput) {
  assertAdmin(actor);
  const code = validateCodeInput(input);
  const partner = await db.partner.findUnique({ where: { id: input.partnerId } });
  if (!partner) throw new DomainError("İş ortağı bulunamadı.");
  try {
    const created = await db.referralCode.create({
      data: {
        code,
        partnerId: input.partnerId,
        discountType: input.discountType,
        discountValue: input.discountValue,
        commissionRateBps: input.commissionRateBps,
        commissionBase: input.commissionBase,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        usageLimit: input.usageLimit,
        active: input.active,
        createdById: actor.id,
        packages: { connect: input.packageIds.map((id) => ({ id })) },
      },
    });
    await audit({ actorId: actor.id, action: "referral_code.create", entityType: "ReferralCode", entityId: created.id, summary: code, data: { ...input, code } });
    return created;
  } catch (err) {
    if (isUniqueViolation(err, "code")) throw new DomainError("Bu kod zaten kullanılıyor. Farklı bir kod seçin.", "CODE_TAKEN");
    throw err;
  }
}

/** Kod değişiklikleri geçmiş siparişleri etkilemez: komisyonlar sipariş anındaki değerlerle saklanır. */
export async function updateReferralCode(actor: Pick<SessionUser, "id" | "role">, codeId: string, input: ReferralCodeInput) {
  assertAdmin(actor);
  const code = validateCodeInput(input);
  const before = await db.referralCode.findUnique({ where: { id: codeId }, include: { packages: { select: { id: true } } } });
  if (!before) throw new DomainError("Kod bulunamadı.", "NOT_FOUND");
  if (before.code !== code && before.usageCount > 0) throw new DomainError("Kullanılmış bir kodun metni değiştirilemez; yeni kod oluşturun.");
  try {
    const updated = await db.referralCode.update({
      where: { id: codeId },
      data: {
        code,
        partnerId: input.partnerId,
        discountType: input.discountType,
        discountValue: input.discountValue,
        commissionRateBps: input.commissionRateBps,
        commissionBase: input.commissionBase,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        usageLimit: input.usageLimit,
        active: input.active,
        packages: { set: input.packageIds.map((id) => ({ id })) },
      },
    });
    await audit({
      actorId: actor.id,
      action: "referral_code.update",
      entityType: "ReferralCode",
      entityId: codeId,
      summary: code,
      data: {
        before: { ...before, packages: before.packages.map((p) => p.id) },
        after: { ...input, code },
      } as unknown as Record<string, unknown>,
    });
    return updated;
  } catch (err) {
    if (isUniqueViolation(err, "code")) throw new DomainError("Bu kod zaten kullanılıyor.", "CODE_TAKEN");
    throw err;
  }
}

export async function setReferralCodeActive(actor: Pick<SessionUser, "id" | "role">, codeId: string, active: boolean) {
  assertAdmin(actor);
  const updated = await db.referralCode.update({ where: { id: codeId }, data: { active } });
  await audit({ actorId: actor.id, action: active ? "referral_code.activate" : "referral_code.deactivate", entityType: "ReferralCode", entityId: codeId, summary: updated.code });
  return updated;
}

// ───────────────────────────── Siparişe kod uygulama ─────────────────────────────

/** Kodun bu kullanıcı ve paket için geçerliliği (indirim hesabı sunucuda yapılır). */
async function resolveCode(codeInput: string, userId: string, packageId: string) {
  const code = normalizeReferralCode(codeInput);
  if (!isValidReferralCode(code)) throw new DomainError("Geçerli bir kod yaz.", "CODE_INVALID");
  const record = await db.referralCode.findUnique({
    where: { code },
    include: { partner: { select: { id: true, active: true, userId: true } }, packages: { select: { id: true } } },
  });
  if (!record) throw new DomainError("Bu kod bulunamadı.", "CODE_INVALID");
  const availability = codeAvailability({ ...record, partnerActive: record.partner.active });
  if (!availability.ok) throw new DomainError(availability.reason, "CODE_UNAVAILABLE");
  if (record.packages.length && !record.packages.some((p) => p.id === packageId)) {
    throw new DomainError("Bu kod seçtiğin pakette geçerli değil.", "CODE_PACKAGE");
  }
  if (record.partner.userId === userId) throw new DomainError("Kendi referans kodunu kullanamazsın.", "CODE_SELF");
  return record;
}

export async function applyReferralCodeToOrder(userId: string, orderNumber: string, codeInput: string) {
  const order = await db.order.findFirst({ where: { number: orderNumber, userId } });
  if (!order) throw new DomainError("Sipariş bulunamadı.", "NOT_FOUND");
  if (order.kind !== "PURCHASE" || order.status !== "PAYMENT_PENDING") throw new DomainError("Bu siparişe artık kod uygulanamaz.", "NOT_PAYABLE");
  const code = await resolveCode(codeInput, userId, order.packageId);
  const snapshot = order.packageSnapshot as unknown as PackageSnapshot;
  const list = order.listPriceKurus ?? snapshot.priceKurus;
  const discount = computeDiscount(list, code.discountType, code.discountValue);
  await db.$transaction(async (tx) => {
    // Tutar değiştiği için başlatılmış ödeme denemeleri geçersiz sayılır
    await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    await tx.order.update({
      where: { id: order.id },
      data: { listPriceKurus: list, discountKurus: discount, priceKurus: list - discount, referralCodeId: code.id, partnerId: code.partnerId },
    });
    await tx.orderEvent.create({
      data: { orderId: order.id, actorId: userId, type: "DISCOUNT", message: `${code.code} kodu uygulandı: ${formatMoney(discount, order.currency)} indirim.`, visibleToCustomer: true },
    });
  });
  return { code: code.code, discountKurus: discount, priceKurus: list - discount };
}

export async function removeReferralCodeFromOrder(userId: string, orderNumber: string) {
  const order = await db.order.findFirst({ where: { number: orderNumber, userId } });
  if (!order) throw new DomainError("Sipariş bulunamadı.", "NOT_FOUND");
  if (order.status !== "PAYMENT_PENDING" || !order.referralCodeId) return;
  const list = order.listPriceKurus ?? order.priceKurus;
  await db.$transaction(async (tx) => {
    await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    await tx.order.update({ where: { id: order.id }, data: { priceKurus: list, discountKurus: 0, referralCodeId: null, partnerId: null } });
  });
}

// ───────────────────────────── Komisyonlar ─────────────────────────────

/**
 * Doğrulanmış ödemede (ödeme işlemi içinde) çağrılır. Her sipariş için en fazla bir komisyon oluşur;
 * aynı bildirim tekrar gelse de orderId/paymentId benzersizliği tekrar kaydı engeller.
 */
export async function recordCommissionForPayment(
  tx: Tx,
  input: { orderId: string; paymentId: string; paidKurus: number; paidAt: Date },
  settings: { vatRatePercent: number; commissionHoldDays: number },
) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: input.orderId },
    select: { referralCodeId: true, partnerId: true, listPriceKurus: true, priceKurus: true, discountKurus: true },
  });
  if (!order.referralCodeId || !order.partnerId) return null;
  const code = await tx.referralCode.findUniqueOrThrow({ where: { id: order.referralCodeId } });
  const calc = computeCommission({
    baseType: code.commissionBase,
    rateBps: code.commissionRateBps,
    listPriceKurus: order.listPriceKurus ?? order.priceKurus + order.discountKurus,
    discountKurus: order.discountKurus,
    paidKurus: input.paidKurus,
    vatRatePercent: settings.vatRatePercent,
  });
  await tx.referralCode.update({ where: { id: code.id }, data: { usageCount: { increment: 1 } } });
  return tx.commission.create({
    data: {
      orderId: input.orderId,
      paymentId: input.paymentId,
      partnerId: order.partnerId,
      referralCodeId: code.id,
      baseType: calc.baseType,
      baseAmountKurus: calc.baseAmountKurus,
      rateBps: calc.rateBps,
      amountKurus: calc.amountKurus,
      calculation: { ...calc, code: code.code } as unknown as Prisma.InputJsonValue,
      eligibleAt: new Date(input.paidAt.getTime() + settings.commissionHoldDays * 24 * 60 * 60 * 1000),
    },
  });
}

export async function commissionSettings() {
  return readSystemSetting("system.commerce");
}

/** İade: ödenmemiş komisyon iptal edilir; ödenmişse sonraki ödemeden mahsup için işaretlenir. */
export async function handleCommissionRefund(tx: Tx, paymentId: string, reason: string) {
  const commission = await tx.commission.findUnique({ where: { paymentId } });
  if (!commission) return null;
  const now = new Date();
  if (commission.status === "PENDING" || commission.status === "APPROVED") {
    await tx.commission.update({ where: { id: commission.id }, data: { status: "CANCELLED", cancelledAt: now, cancelReason: `İade: ${reason}`.slice(0, 300) } });
  } else if (commission.status === "PAID" && !commission.clawbackAt) {
    await tx.commission.update({ where: { id: commission.id }, data: { clawbackAt: now, cancelReason: `Ödeme sonrası iade: ${reason}`.slice(0, 300) } });
  }
  await tx.referralCode.updateMany({ where: { id: commission.referralCodeId, usageCount: { gt: 0 } }, data: { usageCount: { decrement: 1 } } });
  await audit({ actorId: null, action: "commission.refund", entityType: "Commission", entityId: commission.id, summary: reason }, tx);
  return commission.id;
}

export async function approveCommission(actor: Pick<SessionUser, "id" | "role">, commissionId: string) {
  assertAdmin(actor);
  const c = await db.commission.findUnique({ where: { id: commissionId }, include: { payment: { select: { status: true } } } });
  if (!c) throw new DomainError("Komisyon bulunamadı.", "NOT_FOUND");
  if (c.payment.status !== "SUCCEEDED") throw new DomainError("Ödemesi geçerli olmayan satışın komisyonu onaylanamaz.");
  if (c.eligibleAt > new Date()) throw new DomainError("İade/cayma süresi dolmadan komisyon onaylanamaz.");
  const { count } = await db.commission.updateMany({
    where: { id: commissionId, status: "PENDING" },
    data: { status: "APPROVED", approvedAt: new Date(), approvedById: actor.id },
  });
  if (!count) throw new DomainError("Yalnızca bekleyen komisyonlar onaylanabilir.");
  await audit({ actorId: actor.id, action: "commission.approve", entityType: "Commission", entityId: commissionId });
}

export async function cancelCommission(actor: Pick<SessionUser, "id" | "role">, commissionId: string, reason: string) {
  assertAdmin(actor);
  if (reason.trim().length < 3) throw new DomainError("İptal gerekçesini yazın.");
  const { count } = await db.commission.updateMany({
    where: { id: commissionId, status: { in: ["PENDING", "APPROVED"] } },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason.slice(0, 300) },
  });
  if (!count) throw new DomainError("Ödenmiş veya iptal edilmiş komisyon iptal edilemez.");
  await audit({ actorId: actor.id, action: "commission.cancel", entityType: "Commission", entityId: commissionId, summary: reason });
}

/**
 * Komisyon ödemesi kaydı: seçilen onaylı komisyonlar ödendi olarak işaretlenir, ödeme sonrası iade edilen
 * satışların komisyonu mahsup edilir. Tutar yönetici onayı ve denetim kaydıyla saklanır.
 */
export async function recordCommissionPayout(
  actor: Pick<SessionUser, "id" | "role">,
  input: { partnerId: string; commissionIds: string[]; method: string; reference?: string | null; note?: string | null; paidAt: Date },
) {
  assertAdmin(actor);
  const ids = [...new Set(input.commissionIds)];
  if (!ids.length) throw new DomainError("Ödenecek komisyonları seçin.");
  if (input.method.trim().length < 2) throw new DomainError("Ödeme yöntemini yazın (ör. banka havalesi).");
  return db.$transaction(async (tx) => {
    const approved = await tx.commission.findMany({ where: { id: { in: ids }, partnerId: input.partnerId, status: "APPROVED" } });
    if (approved.length !== ids.length) throw new DomainError("Seçilen komisyonların hepsi bu iş ortağına ait ve onaylı olmalı.");
    const clawbacks = await tx.commission.findMany({
      where: { partnerId: input.partnerId, status: "PAID", clawbackAt: { not: null }, clawbackPayoutId: null },
    });
    const gross = approved.reduce((n, c) => n + c.amountKurus, 0);
    const deduction = clawbacks.reduce((n, c) => n + c.amountKurus, 0);
    const net = gross - deduction;
    if (net <= 0) throw new DomainError(`Mahsup edilecek iade tutarı (${formatMoney(deduction)}) ödemeyi aşıyor.`);
    const payout = await tx.commissionPayout.create({
      data: {
        partnerId: input.partnerId,
        amountKurus: net,
        method: input.method.trim(),
        reference: input.reference ?? null,
        note: input.note ?? null,
        paidAt: input.paidAt,
        createdById: actor.id,
      },
    });
    const { count } = await tx.commission.updateMany({
      where: { id: { in: ids }, status: "APPROVED" },
      data: { status: "PAID", paidAt: input.paidAt, payoutId: payout.id },
    });
    if (count !== ids.length) throw new DomainError("Komisyonlar başka bir işlemle güncellendi, tekrar deneyin.");
    if (clawbacks.length) {
      await tx.commission.updateMany({ where: { id: { in: clawbacks.map((c) => c.id) } }, data: { clawbackPayoutId: payout.id } });
    }
    await audit(
      {
        actorId: actor.id,
        action: "commission.payout",
        entityType: "CommissionPayout",
        entityId: payout.id,
        summary: `${formatMoney(net)} — ${approved.length} komisyon`,
        data: { gross, deduction, net, commissionIds: ids, clawbackIds: clawbacks.map((c) => c.id) },
      },
      tx,
    );
    return payout;
  });
}
