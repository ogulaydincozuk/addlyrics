"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { CommissionBase, DiscountType } from "@prisma/client";
import type { ActionState } from "@/lib/action-state";
import { parseDateInput } from "@/lib/dates";
import { parseMoneyToKurus } from "@/lib/money";
import { parsePercentToBps } from "@/lib/referral";
import { requireAdmin } from "@/server/auth/guards";
import { DomainError, isDomainError } from "@/server/domain/errors";
import {
  approveCommission,
  cancelCommission,
  createPartner,
  createPartnerLogin,
  createReferralCode,
  recordCommissionPayout,
  setReferralCodeActive,
  updatePartner,
  updateReferralCode,
  type PartnerInput,
  type ReferralCodeInput,
} from "@/server/domain/referrals";

async function run(fn: (admin: Awaited<ReturnType<typeof requireAdmin>>) => Promise<string | void>): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const message = await fn(admin);
    refresh();
    return { ok: true, message: message || "Kaydedildi." };
  } catch (err) {
    if (isDomainError(err)) return { ok: false, message: err.message };
    console.error("[admin:partners]", err);
    return { ok: false, message: "İşlem tamamlanamadı." };
  }
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function partnerInput(fd: FormData): PartnerInput {
  const name = str(fd, "name");
  if (name.length < 2) throw new DomainError("İş ortağının adını yazın.");
  const socialAccounts = str(fd, "social")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((l) => {
      const [platform, ...rest] = l.split(":");
      return rest.length ? { platform: platform!.trim().slice(0, 40), handle: rest.join(":").trim().slice(0, 200) } : { platform: "diğer", handle: l.slice(0, 200) };
    });
  return {
    name: name.slice(0, 120),
    email: str(fd, "email").slice(0, 200) || null,
    phone: str(fd, "phone").slice(0, 40) || null,
    socialAccounts,
    notes: str(fd, "notes").slice(0, 4000) || null,
    active: fd.get("active") === "on",
  };
}

export async function createPartnerAction(_prev: ActionState, fd: FormData) {
  let id: string | null = null;
  const result = await run(async (admin) => {
    id = (await createPartner(admin, partnerInput(fd))).id;
    return "İş ortağı oluşturuldu.";
  });
  if (result.ok && id) redirect(`/admin/is-ortaklari/${id}`);
  return result;
}

export async function updatePartnerAction(partnerId: string, _prev: ActionState, fd: FormData) {
  return run(async (admin) => {
    await updatePartner(admin, partnerId, partnerInput(fd));
    return "İş ortağı güncellendi.";
  });
}

export async function createPartnerLoginAction(partnerId: string, _prev: ActionState, fd: FormData) {
  return run(async (admin) => {
    const r = await createPartnerLogin(admin, partnerId, str(fd, "email"));
    return r.emailSent ? "Panel hesabı oluşturuldu; şifre belirleme bağlantısı gönderildi." : "Hesap oluşturuldu ancak e-posta gönderilemedi (e-posta ayarlarını kontrol edin).";
  });
}

function codeInput(fd: FormData): ReferralCodeInput {
  const discountType = str(fd, "discountType") as DiscountType;
  if (discountType !== "PERCENT" && discountType !== "FIXED") throw new DomainError("İndirim türünü seçin.");
  const rawDiscount = str(fd, "discountValue") || "0";
  const discountValue = discountType === "PERCENT" ? parsePercentToBps(rawDiscount) : parseMoneyToKurus(rawDiscount);
  if (discountValue == null) throw new DomainError("İndirim değerini geçerli biçimde yazın (ör. 10 veya 250,00).");
  const commissionRateBps = parsePercentToBps(str(fd, "commissionRate"));
  if (commissionRateBps == null) throw new DomainError("Komisyon oranını yüzde olarak yazın (ör. 10).");
  const commissionBase = str(fd, "commissionBase") as CommissionBase;
  if (!["LIST_PRICE", "PAID_AMOUNT", "PAID_AMOUNT_EXCL_VAT"].includes(commissionBase)) {
    throw new DomainError("Komisyonun hangi tutar üzerinden hesaplanacağını seçin.");
  }
  const usageLimitRaw = str(fd, "usageLimit");
  const usageLimit = usageLimitRaw ? Number(usageLimitRaw) : null;
  if (usageLimit != null && (!Number.isInteger(usageLimit) || usageLimit < 1)) throw new DomainError("Kullanım limiti pozitif tam sayı olmalı.");
  const partnerId = str(fd, "partnerId");
  if (!partnerId) throw new DomainError("İş ortağını seçin.");
  return {
    code: str(fd, "code"),
    partnerId,
    discountType,
    discountValue,
    commissionRateBps,
    commissionBase,
    startsAt: str(fd, "startsAt") ? parseDateInput(str(fd, "startsAt")) : null,
    endsAt: str(fd, "endsAt") ? parseDateInput(str(fd, "endsAt")) : null,
    usageLimit,
    active: fd.get("active") === "on",
    packageIds: fd.getAll("packageIds").map(String).filter(Boolean),
  };
}

export async function createCodeAction(_prev: ActionState, fd: FormData) {
  return run(async (admin) => {
    const c = await createReferralCode(admin, codeInput(fd));
    return `${c.code} kodu oluşturuldu.`;
  });
}

export async function updateCodeAction(codeId: string, _prev: ActionState, fd: FormData) {
  return run(async (admin) => {
    const c = await updateReferralCode(admin, codeId, codeInput(fd));
    return `${c.code} güncellendi.`;
  });
}

export async function toggleCodeAction(codeId: string, active: boolean, _prev: ActionState) {
  return run(async (admin) => {
    await setReferralCodeActive(admin, codeId, active);
    return active ? "Kod etkinleştirildi." : "Kod pasifleştirildi.";
  });
}

export async function approveCommissionAction(commissionId: string, _prev: ActionState) {
  return run(async (admin) => {
    await approveCommission(admin, commissionId);
    return "Komisyon onaylandı.";
  });
}

export async function cancelCommissionAction(commissionId: string, _prev: ActionState, fd: FormData) {
  return run(async (admin) => {
    await cancelCommission(admin, commissionId, str(fd, "reason"));
    return "Komisyon iptal edildi.";
  });
}

export async function recordPayoutAction(partnerId: string, _prev: ActionState, fd: FormData) {
  return run(async (admin) => {
    const paidAt = str(fd, "paidAt") ? parseDateInput(str(fd, "paidAt")) : new Date();
    if (!paidAt) throw new DomainError("Ödeme tarihini kontrol edin.");
    const payout = await recordCommissionPayout(admin, {
      partnerId,
      commissionIds: fd.getAll("commissionIds").map(String),
      method: str(fd, "method"),
      reference: str(fd, "reference") || null,
      note: str(fd, "note") || null,
      paidAt,
    });
    return `Ödeme kaydedildi (${(payout.amountKurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} TL).`;
  });
}
