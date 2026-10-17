import "server-only";
import type { Prisma } from "@prisma/client";
import {
  DEFAULT_SYSTEM_SETTINGS,
  SYSTEM_SETTING_SCHEMAS,
  type SystemSettingKey,
  type SystemSettingValue,
} from "@/content/system-settings";
import { db } from "./db";

/** İş kuralları için güncel ayar (önbelleksiz). Kayıt yoksa veya geçersizse varsayılan döner. */
export async function readSystemSetting<K extends SystemSettingKey>(key: K): Promise<SystemSettingValue<K>> {
  const row = await db.siteSetting.findUnique({ where: { key_locale: { key, locale: "tr" } } });
  const fallback = DEFAULT_SYSTEM_SETTINGS[key];
  if (!row) return fallback;
  const parsed = SYSTEM_SETTING_SCHEMAS[key].safeParse({ ...fallback, ...(row.value as object) });
  return (parsed.success ? parsed.data : fallback) as SystemSettingValue<K>;
}

export async function writeSystemSetting<K extends SystemSettingKey>(key: K, value: SystemSettingValue<K>, adminId: string) {
  const parsed = SYSTEM_SETTING_SCHEMAS[key].parse(value);
  await db.siteSetting.upsert({
    where: { key_locale: { key, locale: "tr" } },
    create: { key, locale: "tr", value: parsed as Prisma.InputJsonValue, updatedById: adminId },
    update: { value: parsed as Prisma.InputJsonValue, updatedById: adminId },
  });
}
