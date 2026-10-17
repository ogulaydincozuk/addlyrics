"use server";

import { refresh, updateTag } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { commerceSettingsSchema, trialSettingsSchema } from "@/content/system-settings";
import { audit } from "@/server/audit";
import { requireAdmin } from "@/server/auth/guards";
import { CACHE_TAGS } from "@/server/queries/public";
import { readSystemSetting, writeSystemSetting } from "@/server/system-settings";

const num = (fd: FormData, k: string) => Number(String(fd.get(k) ?? "").replace(",", "."));

export async function saveTrialSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = trialSettingsSchema.safeParse({
    enabled: fd.get("enabled") === "on",
    previewTargetHours: num(fd, "previewTargetHours"),
    previewSeconds: num(fd, "previewSeconds"),
    previewStartSeconds: num(fd, "previewStartSeconds"),
    watermark: fd.get("watermark") === "on",
    blur: fd.get("blur") === "on",
    maxOpenTrials: num(fd, "maxOpenTrials"),
    conversionBusinessDays: num(fd, "conversionBusinessDays"),
    retentionDays: num(fd, "retentionDays"),
  });
  if (!parsed.success) return { ok: false, message: "Değerleri kontrol edin: " + parsed.error.issues.map((i) => i.path.join(".")).join(", ") };
  const before = await readSystemSetting("system.trial");
  await writeSystemSetting("system.trial", parsed.data, admin.id);
  await audit({ actorId: admin.id, action: "settings.trial", entityType: "SiteSetting", entityId: "system.trial", data: { before, after: parsed.data } });
  updateTag(CACHE_TAGS.settings);
  refresh();
  return { ok: true, message: "Deneme ayarları kaydedildi." };
}

export async function saveCommerceSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = commerceSettingsSchema.safeParse({ vatRatePercent: num(fd, "vatRatePercent"), commissionHoldDays: num(fd, "commissionHoldDays") });
  if (!parsed.success) return { ok: false, message: "Değerleri kontrol edin." };
  const before = await readSystemSetting("system.commerce");
  await writeSystemSetting("system.commerce", parsed.data, admin.id);
  await audit({ actorId: admin.id, action: "settings.commerce", entityType: "SiteSetting", entityId: "system.commerce", data: { before, after: parsed.data } });
  updateTag(CACHE_TAGS.settings);
  refresh();
  return { ok: true, message: "Ticari ayarlar kaydedildi. Yeni değerler yalnızca bundan sonraki komisyonlara uygulanır." };
}
