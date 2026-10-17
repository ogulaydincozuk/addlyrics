"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { PORTFOLIO_CATEGORIES, VIDEO_FORMATS } from "@/lib/enums";
import { flattenErrors } from "@/lib/validation";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { isDomainError } from "@/server/domain/errors";
import { resolveTikTokUrl } from "@/server/embeds";
import { CACHE_TAGS } from "@/server/queries/public";

const baseSchema = z.object({
  title: z.string().trim().min(2, "Başlık gerekli.").max(120),
  description: z.string().trim().min(2, "Kısa açıklama gerekli.").max(300),
  category: z.enum(PORTFOLIO_CATEGORIES),
  orientation: z.enum(VIDEO_FORMATS),
  sortOrder: z.coerce.number().int().min(0).max(999),
  published: z.boolean(),
});

function readBase(fd: FormData) {
  return baseSchema.safeParse({
    title: fd.get("title"),
    description: fd.get("description"),
    category: fd.get("category"),
    orientation: fd.get("orientation") ?? "VERTICAL",
    sortOrder: fd.get("sortOrder") || 0,
    published: fd.get("published") === "on",
  });
}

function done(message: string): ActionState {
  updateTag(CACHE_TAGS.portfolio);
  refresh();
  return { ok: true, message };
}

/** TikTok bağlantısıyla örnek ekleme (resmî gömülü oynatıcı; video indirilmez). */
export async function addTikTokItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const base = readBase(fd);
  if (!base.success) return { ok: false, errors: flattenErrors(base.error) };
  try {
    const embed = await resolveTikTokUrl(String(fd.get("url") ?? ""));
    const exists = await db.portfolioItem.findFirst({ where: { embedProvider: "tiktok", embedId: embed.id } });
    if (exists) return { ok: false, message: "Bu video zaten portfolyoda." };
    await db.portfolioItem.create({
      data: {
        ...base.data,
        embedProvider: "tiktok",
        embedId: embed.id,
        authorHandle: embed.handle,
        sourceUrl: embed.sourceUrl,
      },
    });
  } catch (err) {
    if (isDomainError(err)) return { ok: false, message: err.message };
    return { ok: false, message: "TikTok bağlantısına ulaşılamadı. Tam video adresini deneyin." };
  }
  return done("Örnek eklendi.");
}

/** Yüklenen video (+ kapak görseli) ile örnek ekleme. */
export async function addUploadedItemAction(videoFileId: string, posterFileId: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const base = readBase(fd);
  if (!base.success) return { ok: false, errors: flattenErrors(base.error) };
  const video = await db.uploadedFile.findFirst({ where: { id: videoFileId, kind: "PORTFOLIO_VIDEO", status: "UPLOADED" } });
  if (!video) return { ok: false, message: "Önce videoyu yükle." };
  if (posterFileId) {
    const poster = await db.uploadedFile.findFirst({ where: { id: posterFileId, kind: "PORTFOLIO_POSTER", status: "UPLOADED" } });
    if (!poster) return { ok: false, message: "Kapak görseli bulunamadı." };
  }
  await db.portfolioItem.create({ data: { ...base.data, videoFileId, posterFileId } });
  return done("Örnek eklendi.");
}

export async function updateItemAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const base = readBase(fd);
  if (!base.success) return { ok: false, errors: flattenErrors(base.error) };
  await db.portfolioItem.update({ where: { id }, data: base.data });
  return done("Kaydedildi.");
}

export async function deleteItemAction(id: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireAdmin();
  await db.portfolioItem.delete({ where: { id } });
  return done("Örnek silindi.");
}
