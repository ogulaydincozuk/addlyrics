"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { VIDEO_FORMATS, VIDEO_STYLES } from "@/lib/enums";
import { parseMoneyToKurus } from "@/lib/money";
import { slugify } from "@/lib/slug";
import { flattenErrors } from "@/lib/validation";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { isDomainError, isUniqueViolation } from "@/server/domain/errors";
import { linkPackageToShopify, syncShopifyListing } from "@/server/payments/shopify-sync";
import { CACHE_TAGS } from "@/server/queries/public";

const optionalInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(min).max(max).nullable());
const optionalText = (max: number) => z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim() : null), z.string().max(max).nullable());

const packageSchema = z.object({
  name: z.string().trim().min(2, "Paket adı gerekli.").max(80),
  slug: z.string().trim().max(60),
  tagline: optionalText(160),
  durationMonths: z.coerce.number().int().min(1, "Süre en az 1 ay olmalı.").max(36),
  price: z.string().trim().max(20),
  videoCount: optionalInt(1, 1000),
  bonusVideoCount: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int().min(0).max(1000)),
  deliveryTerms: optionalText(600),
  deliveryDays: optionalInt(1, 365),
  includedFormats: z.array(z.enum(VIDEO_FORMATS)),
  includedStyles: z.array(z.enum(VIDEO_STYLES)),
  features: z.string().max(2000),
  isFeatured: z.boolean(),
  isSample: z.boolean(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  sortOrder: z.coerce.number().int().min(0).max(999),
  trialCountsTowardPackage: z.boolean(),
  trialConversionBusinessDays: optionalInt(1, 60),
});

export async function savePackageAction(packageId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = packageSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") ?? "",
    tagline: formData.get("tagline"),
    durationMonths: formData.get("durationMonths"),
    price: formData.get("price") ?? "",
    videoCount: formData.get("videoCount"),
    bonusVideoCount: formData.get("bonusVideoCount"),
    deliveryTerms: formData.get("deliveryTerms"),
    deliveryDays: formData.get("deliveryDays"),
    includedFormats: formData.getAll("includedFormats"),
    includedStyles: formData.getAll("includedStyles"),
    features: formData.get("features") ?? "",
    isFeatured: formData.get("isFeatured") === "on",
    isSample: formData.get("isSample") === "on",
    status: formData.get("status"),
    sortOrder: formData.get("sortOrder") || 0,
    trialCountsTowardPackage: formData.get("trialCountsTowardPackage") === "on",
    trialConversionBusinessDays: formData.get("trialConversionBusinessDays"),
  });
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error), message: "Lütfen alanları kontrol et." };
  const d = parsed.data;

  let priceKurus: number | null = null;
  if (d.price) {
    priceKurus = parseMoneyToKurus(d.price);
    if (priceKurus == null || priceKurus <= 0) return { ok: false, errors: { price: "Geçerli bir fiyat gir (örn. 4.990 veya 4990,00)." } };
  }
  const slug = slugify(d.slug || d.name);
  if (!slug) return { ok: false, errors: { slug: "Geçerli bir adres (slug) gir." } };

  const data = {
    name: d.name,
    slug,
    tagline: d.tagline,
    durationMonths: d.durationMonths,
    priceKurus,
    videoCount: d.videoCount,
    bonusVideoCount: d.bonusVideoCount,
    deliveryTerms: d.deliveryTerms,
    deliveryDays: d.deliveryDays,
    includedFormats: d.includedFormats,
    includedStyles: d.includedStyles,
    features: d.features
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean)
      .slice(0, 12),
    isFeatured: d.isFeatured,
    isSample: d.isSample,
    status: d.status,
    sortOrder: d.sortOrder,
    trialCountsTowardPackage: d.trialCountsTowardPackage,
    trialConversionBusinessDays: d.trialConversionBusinessDays,
  };

  let id = packageId;
  try {
    if (packageId) {
      await db.package.update({ where: { id: packageId }, data });
    } else {
      id = (await db.package.create({ data })).id;
    }
  } catch (err) {
    if (isUniqueViolation(err, "slug")) return { ok: false, errors: { slug: "Bu adres başka bir pakette kullanılıyor." } };
    throw err;
  }
  updateTag(CACHE_TAGS.packages);
  if (!packageId) redirect(`/admin/paketler/${id}`);
  return { ok: true, message: "Paket kaydedildi. Mevcut siparişler sipariş anındaki koşullarla devam eder." };
}

export async function linkShopifyAction(packageId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await linkPackageToShopify(packageId, String(formData.get("productGid") ?? ""), String(formData.get("variantGid") ?? ""));
  } catch (err) {
    if (isDomainError(err)) return { ok: false, message: err.message };
    throw err;
  }
  updateTag(CACHE_TAGS.packages);
  return { ok: true, message: "Shopify eşlemesi kaydedildi. Satışa açmak için fiyatı Shopify'dan doğrula." };
}

export async function syncShopifyAction(packageId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const listing = await syncShopifyListing(packageId);
    const pkg = await db.package.findUniqueOrThrow({ where: { id: packageId } });
    updateTag(CACHE_TAGS.packages);
    if (listing.externalPriceKurus !== pkg.priceKurus || listing.currency !== pkg.currency) {
      return { ok: false, message: "Shopify fiyatı AddLyrics fiyatıyla eşleşmiyor; paket Shopify üzerinden satışa açılmaz." };
    }
    return { ok: true, message: "Shopify fiyatı doğrulandı ve AddLyrics fiyatıyla eşleşiyor." };
  } catch (err) {
    if (isDomainError(err)) return { ok: false, message: err.message };
    return { ok: false, message: `Shopify'a bağlanılamadı: ${(err as Error).message}` };
  }
}

export async function unlinkShopifyAction(packageId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  await requireAdmin();
  await db.packageChannelListing.deleteMany({ where: { packageId, channel: "SHOPIFY" } });
  updateTag(CACHE_TAGS.packages);
  return { ok: true, message: "Shopify eşlemesi kaldırıldı." };
}
