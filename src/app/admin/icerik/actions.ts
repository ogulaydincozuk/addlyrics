"use server";

import { refresh, updateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { CONTENT_PAGE_SLUGS, DEFAULT_SETTINGS, SETTING_SCHEMAS, type SettingKey } from "@/content/settings";
import type { ActionState } from "@/lib/action-state";
import { flattenErrors } from "@/lib/validation";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { CACHE_TAGS } from "@/server/queries/public";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const lines = (fd: FormData, k: string) =>
  str(fd, k)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

function readSetting(key: SettingKey, fd: FormData): unknown {
  if (key === "home") {
    return {
      heroTitle: str(fd, "heroTitle"),
      heroDescription: str(fd, "heroDescription"),
      heroPrimaryCta: str(fd, "heroPrimaryCta"),
      heroSecondaryCta: str(fd, "heroSecondaryCta"),
      trustPoints: [0, 1, 2].map((i) => str(fd, `trustPoints.${i}`)),
      stylesTitle: str(fd, "stylesTitle"),
      styles: Object.fromEntries(
        (["FILM_EDIT", "MINIMAL", "MUSIC_VIDEO"] as const).map((s) => [s, { title: str(fd, `styles.${s}.title`), description: str(fd, `styles.${s}.description`) }]),
      ),
      stepsTitle: str(fd, "stepsTitle"),
      steps: [0, 1, 2, 3].map((i) => ({ title: str(fd, `steps.${i}.title`), description: str(fd, `steps.${i}.description`) })),
      packagesTitle: str(fd, "packagesTitle"),
      packagesDescription: str(fd, "packagesDescription"),
      portfolioTitle: str(fd, "portfolioTitle"),
      portfolioDescription: str(fd, "portfolioDescription"),
      whyTitle: str(fd, "whyTitle"),
      whyPoints: lines(fd, "whyPoints"),
      faqTitle: str(fd, "faqTitle"),
      finalTitle: str(fd, "finalTitle"),
      finalDescription: str(fd, "finalDescription"),
      finalCta: str(fd, "finalCta"),
    };
  }
  const keys = Object.keys(DEFAULT_SETTINGS[key]);
  return Object.fromEntries(keys.map((k) => [k, str(fd, k)]));
}

export async function saveSettingAction(key: SettingKey, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = SETTING_SCHEMAS[key].safeParse(readSetting(key, formData));
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), message: "Bazı alanlar geçersiz." };
  const required = key === "home";
  if (required && Object.values(parsed.data).some((v) => v === "")) return { ok: false, message: "Ana sayfa metinleri boş bırakılamaz." };
  await db.siteSetting.upsert({
    where: { key_locale: { key, locale: "tr" } },
    create: { key, locale: "tr", value: parsed.data as Prisma.InputJsonValue, updatedById: admin.id },
    update: { value: parsed.data as Prisma.InputJsonValue, updatedById: admin.id },
  });
  updateTag(CACHE_TAGS.settings);
  return { ok: true, message: "Kaydedildi. Değişiklikler sitede yayında." };
}

export async function resetSettingAction(key: SettingKey, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireAdmin();
  await db.siteSetting.deleteMany({ where: { key, locale: "tr" } });
  updateTag(CACHE_TAGS.settings);
  refresh();
  return { ok: true, message: "Varsayılan metinlere dönüldü." };
}

// ───────────────────────────── SSS ─────────────────────────────

const faqSchema = z.object({
  question: z.string().trim().min(5, "Soru en az 5 karakter olmalı.").max(200),
  answer: z.string().trim().min(5, "Cevap gerekli.").max(4000),
  sortOrder: z.coerce.number().int().min(0).max(999),
  published: z.boolean(),
  needsReview: z.boolean(),
});

export async function saveFaqAction(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = faqSchema.safeParse({
    question: fd.get("question"),
    answer: fd.get("answer"),
    sortOrder: fd.get("sortOrder") || 0,
    published: fd.get("published") === "on",
    needsReview: fd.get("needsReview") === "on",
  });
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
  if (id) await db.faqItem.update({ where: { id }, data: parsed.data });
  else await db.faqItem.create({ data: { ...parsed.data, locale: "tr" } });
  updateTag(CACHE_TAGS.faq);
  refresh();
  return { ok: true, message: id ? "Soru güncellendi." : "Soru eklendi." };
}

export async function deleteFaqAction(id: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireAdmin();
  await db.faqItem.delete({ where: { id } });
  updateTag(CACHE_TAGS.faq);
  refresh();
  return { ok: true, message: "Soru silindi." };
}

// ───────────────────────────── Sayfalar ─────────────────────────────

const pageSchema = z.object({
  title: z.string().trim().min(2).max(120),
  metaDescription: z.string().trim().max(300),
  body: z.string().trim().min(10, "Sayfa içeriği gerekli.").max(60000),
  reviewed: z.boolean(),
});

export async function savePageAction(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!(CONTENT_PAGE_SLUGS as readonly string[]).includes(slug)) return { ok: false, message: "Bilinmeyen sayfa." };
  const parsed = pageSchema.safeParse({
    title: fd.get("title"),
    metaDescription: fd.get("metaDescription") ?? "",
    body: fd.get("body"),
    reviewed: fd.get("reviewed") === "on",
  });
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
  const existing = await db.contentPage.findUnique({ where: { slug_locale: { slug, locale: "tr" } } });
  const reviewedAt = parsed.data.reviewed ? (existing?.reviewedAt ?? new Date()) : null;
  await db.contentPage.upsert({
    where: { slug_locale: { slug, locale: "tr" } },
    create: {
      slug,
      locale: "tr",
      title: parsed.data.title,
      metaDescription: parsed.data.metaDescription || null,
      body: parsed.data.body,
      isLegal: slug !== "hakkimizda",
      reviewedAt,
    },
    update: { title: parsed.data.title, metaDescription: parsed.data.metaDescription || null, body: parsed.data.body, reviewedAt },
  });
  updateTag(CACHE_TAGS.pages);
  return { ok: true, message: "Sayfa kaydedildi." };
}
