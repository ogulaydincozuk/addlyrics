import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma, type OrderStatus } from "@prisma/client";
import { batchDateForIndex, deliverySchedule } from "@/lib/delivery-plan";
import { CUSTOMER_FILE_KINDS, type CustomerFileKind } from "@/lib/enums";
import { messages } from "@/i18n/config";
import { missingRequiredItems } from "@/lib/order-requirements";
import { canTransition } from "@/lib/order-status";
import { TRIAL_VIDEO_COUNT, trialConversionPlan } from "@/lib/trial";
import { buildSnapshot, snapshotTotalVideos, type PackageSnapshot } from "@/lib/packages";
import type { OrderInput } from "@/lib/validation";
import { db, type Tx } from "../db";
import { notifyAdmins, notifyUser } from "../notify";
import { DomainError, isUniqueViolation } from "./errors";
import { packageSaleState, SALE_STATE_MESSAGES } from "./packages";

export const TERMS_VERSION = "2026-10-taslak-1";

const ORDER_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 karakter, karışabilen karakterler yok

export function generateOrderNumber(date = new Date()) {
  const bytes = randomBytes(6);
  let suffix = "";
  for (const b of bytes) suffix += ORDER_ALPHABET[b % 32];
  const yy = String(date.getUTCFullYear()).slice(2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `AL-${yy}${mm}-${suffix}`;
}

/** Benzersiz sipariş numarasıyla oluşturma; nadir çakışmalarda yeniden dener. */
async function withUniqueOrderNumber<T>(fn: (number: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn(generateOrderNumber());
    } catch (err) {
      if (isUniqueViolation(err, "number") && attempt < 4) continue;
      throw err;
    }
  }
  throw new DomainError("Sipariş numarası üretilemedi, lütfen tekrar dene.");
}

function assertWithinPackage(snapshot: Pick<PackageSnapshot, "includedStyles" | "includedFormats">, input: OrderInput) {
  if (!snapshot.includedStyles.includes(input.style.style)) {
    throw new DomainError(
      `${messages().enums.videoStyle[input.style.style]} bu paketin kapsamında değil.`,
      "STYLE_NOT_INCLUDED",
    );
  }
  const notIncluded = input.format.formats.filter((f) => !snapshot.includedFormats.includes(f));
  if (notIncluded.length) {
    throw new DomainError(
      `Şu formatlar bu pakete dahil değil: ${notIncluded.map((f) => messages().enums.videoFormat[f]).join(", ")}`,
      "FORMAT_NOT_INCLUDED",
    );
  }
}

/** Müşterinin daha önce yüklediği ve henüz bir siparişe bağlanmamış dosyalarını doğrular. */
async function loadAttachableFiles(client: Tx | typeof db, userId: string, fileIds: string[]) {
  const unique = [...new Set(fileIds)];
  if (!unique.length) return [];
  const files = await client.uploadedFile.findMany({
    where: {
      id: { in: unique },
      ownerId: userId,
      status: "UPLOADED",
      orderId: null,
      kind: { in: [...CUSTOMER_FILE_KINDS] },
    },
    select: { id: true, kind: true },
  });
  if (files.length !== unique.length) {
    throw new DomainError("Bazı dosyalar bulunamadı veya yüklemesi tamamlanmadı. Lütfen dosyaları kontrol et.", "FILES");
  }
  return files as Array<{ id: string; kind: CustomerFileKind }>;
}

function orderData(input: OrderInput) {
  return {
    style: input.style.style,
    customStyleRequest: input.style.style === "CUSTOM" ? (input.style.customStyleRequest ?? null) : null,
    footageSource: input.style.style === "FILM_EDIT" ? (input.style.footageSource ?? null) : null,
    fontPreference: input.style.fontPreference ?? null,
    colorPreference: input.style.colorPreference ?? null,
    referenceUrl: input.style.referenceUrl ?? null,
    notesForEditor: input.style.notesForEditor ?? null,
    formats: input.format.formats,
    platforms: input.format.platforms,
    otherPlatform: input.format.platforms.includes("OTHER") ? (input.format.otherPlatform ?? null) : null,
    videoCount: input.format.videoCount,
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: new Date(),
    rightsConfirmedAt: new Date(),
  };
}

function songData(userId: string, input: OrderInput) {
  return {
    userId,
    artistName: input.song.artistName,
    title: input.song.title,
    releaseStatus: input.song.releaseStatus,
    language: input.song.language,
    lyrics: input.song.lyrics ?? null,
    streamingUrl: input.song.streamingUrl ?? null,
  };
}

/** Sipariş kalemleri: istenen video adedi kadar proje (video işi) oluşturur; teslim tarihleri aylık plana göre. */
async function createProjects(tx: Tx, orderId: string, count: number, dueDates: Array<Date | null> = []) {
  await tx.project.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      orderId,
      sequence: i + 1,
      title: `Video ${i + 1}`,
      dueDate: dueDates[i] ?? null,
    })),
  });
}

// ───────────────────────────── Satın alma siparişi ─────────────────────────────

/**
 * Paket satın alma siparişi. Fiyat her zaman sunucuda paketten alınır.
 * Sipariş "Ödeme Bekleniyor" durumunda oluşur; haklar yalnızca doğrulanmış ödemeyle tanımlanır.
 */
export async function createPurchaseOrder(userId: string, packageSlug: string, input: OrderInput) {
  const pkg = await db.package.findUnique({ where: { slug: packageSlug }, include: { channelListings: true } });
  if (!pkg) throw new DomainError("Paket bulunamadı.", "PACKAGE");
  const state = packageSaleState(pkg);
  if (!state.purchasable) throw new DomainError(SALE_STATE_MESSAGES[state.reason], "PACKAGE_NOT_PURCHASABLE");

  const snapshot = buildSnapshot(pkg);
  assertWithinPackage(snapshot, input);
  if (input.format.videoCount > snapshotTotalVideos(snapshot)) {
    throw new DomainError(`Bu pakette en fazla ${snapshotTotalVideos(snapshot)} video bulunuyor.`, "VIDEO_COUNT");
  }

  const files = await loadAttachableFiles(db, userId, input.fileIds);

  const order = await withUniqueOrderNumber((number) =>
    db.$transaction(async (tx) => {
      const song = await tx.song.create({ data: songData(userId, input) });
      const created = await tx.order.create({
        data: {
          ...orderData(input),
          number,
          userId,
          packageId: pkg.id,
          songId: song.id,
          kind: "PURCHASE",
          status: "PAYMENT_PENDING",
          packageSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          priceKurus: snapshot.priceKurus,
          currency: snapshot.currency,
        },
      });
      if (files.length) {
        // orderId: null koşulu, aynı dosyanın eşzamanlı iki siparişe bağlanmasını engeller
        const { count } = await tx.uploadedFile.updateMany({
          where: { id: { in: files.map((f) => f.id) }, orderId: null },
          data: { orderId: created.id, songId: song.id },
        });
        if (count !== files.length) throw new DomainError("Dosyalar başka bir siparişe bağlanmış.", "FILES");
      }
      await tx.orderEvent.create({
        data: {
          orderId: created.id,
          actorId: userId,
          type: "CREATED",
          toStatus: "PAYMENT_PENDING",
          message: "Sipariş oluşturuldu, ödeme bekleniyor.",
          visibleToCustomer: true,
        },
      });
      return created;
    }),
  );

  return order;
}

// ───────────────────────────── Ücretsiz denemeden satın alma ─────────────────────────────

/**
 * Ön izlemeleri hazır denemeyi seçilen paketle satın almaya dönüştüren sipariş (ödeme bekler).
 * Deneme videoları yeniden üretilmez: ödeme doğrulandığında bu siparişin ilk 3 videosu olarak bağlanır.
 */
export async function createTrialPurchaseOrder(userId: string, packageSlug: string) {
  const trial = await db.trialApplication.findUnique({
    where: { userId },
    include: { videos: { select: { status: true, masterFileId: true } }, song: true },
  });
  if (!trial) throw new DomainError("Deneme başvurusu bulunamadı.", "NOT_FOUND");
  if (trial.convertedOrderId) throw new DomainError("Denemen zaten bir pakete dönüştürüldü.", "TRIAL_CONVERTED");
  if (trial.purgedAt) throw new DomainError("Deneme dosyalarının saklama süresi dolduğu için bu deneme satın almaya dönüştürülemez.", "TRIAL_PURGED");
  if (trial.status !== "PREVIEW_READY" || trial.videos.length !== TRIAL_VIDEO_COUNT || trial.videos.some((v) => !v.masterFileId)) {
    throw new DomainError("Üç ön izlemen hazır olduğunda paket satın alabilirsin.", "TRIAL_NOT_READY");
  }

  const pkg = await db.package.findUnique({ where: { slug: packageSlug }, include: { channelListings: true } });
  if (!pkg) throw new DomainError("Paket bulunamadı.", "PACKAGE");
  const state = packageSaleState(pkg);
  if (!state.purchasable) throw new DomainError(SALE_STATE_MESSAGES[state.reason], "PACKAGE_NOT_PURCHASABLE");
  const snapshot = buildSnapshot(pkg);
  const plan = trialConversionPlan({
    videoCount: snapshot.videoCount,
    bonusVideoCount: snapshot.bonusVideoCount ?? 0,
    durationMonths: snapshot.durationMonths,
    countsTowardPackage: snapshot.trialCountsTowardPackage ?? true,
  });
  if (plan.packageTotal < TRIAL_VIDEO_COUNT && (snapshot.trialCountsTowardPackage ?? true)) {
    throw new DomainError("Bu paket deneme videolarını kapsamıyor.", "PACKAGE");
  }
  const firstVideo = await db.trialVideo.findFirst({ where: { trialId: trial.id }, orderBy: { sequence: "asc" }, select: { style: true } });
  const style = firstVideo && snapshot.includedStyles.includes(firstVideo.style) ? firstVideo.style : snapshot.includedStyles[0]!;
  const formats = trial.formats.filter((f) => snapshot.includedFormats.includes(f));

  return withUniqueOrderNumber((number) =>
    db.$transaction(async (tx) => {
      // Aynı deneme için bekleyen eski satın alma denemeleri kapatılır (paket değişikliği)
      const stale = await tx.order.findMany({ where: { trialApplicationId: trial.id, userId, status: "PAYMENT_PENDING" }, select: { id: true } });
      if (stale.length) {
        await tx.order.updateMany({
          where: { id: { in: stale.map((o) => o.id) } },
          data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Yeni paket seçildi" },
        });
        await tx.payment.updateMany({ where: { orderId: { in: stale.map((o) => o.id) }, status: "PENDING" }, data: { status: "CANCELLED" } });
      }
      const created = await tx.order.create({
        data: {
          number,
          userId,
          packageId: pkg.id,
          songId: trial.songId,
          trialApplicationId: trial.id,
          kind: "PURCHASE",
          status: "PAYMENT_PENDING",
          videoCount: plan.orderVideoCount,
          style,
          footageSource: style === "FILM_EDIT" ? (trial.footageSource ?? "ADDLYRICS_LICENSED") : null,
          notesForEditor: trial.notesForEditor,
          formats: formats.length ? formats : [snapshot.includedFormats[0]!],
          platforms: [],
          packageSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          priceKurus: snapshot.priceKurus,
          listPriceKurus: snapshot.priceKurus,
          currency: snapshot.currency,
          termsVersion: TERMS_VERSION,
          termsAcceptedAt: new Date(),
          rightsConfirmedAt: trial.rightsConfirmedAt,
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: created.id,
          actorId: userId,
          type: "CREATED",
          toStatus: "PAYMENT_PENDING",
          message: `Ücretsiz denemeden (${trial.number}) satın alma: ${plan.trialVideos} deneme videosu + ${plan.newVideos} yeni video. Ödeme bekleniyor.`,
          visibleToCustomer: true,
        },
      });
      return created;
    }),
  );
}

// ───────────────────────────── Mevcut paket hakkından sipariş ─────────────────────────────

export function entitlementIsUsable(ent: { status: string; startsAt: Date; endsAt: Date }, now = new Date()) {
  return ent.status === "ACTIVE" && ent.startsAt <= now && ent.endsAt > now;
}

/** Aktif paket hakkı kullanılarak yeni şarkı siparişi (ödeme gerekmez). */
export async function createEntitlementOrder(userId: string, entitlementId: string, input: OrderInput) {
  const ent = await db.packageEntitlement.findFirst({
    where: { id: entitlementId, userId },
    include: { sourceOrder: { select: { packageSnapshot: true } } },
  });
  if (!ent) throw new DomainError("Paket hakkı bulunamadı.", "ENTITLEMENT");
  if (!entitlementIsUsable(ent)) throw new DomainError("Bu paketin süresi dolmuş veya paket aktif değil.", "ENTITLEMENT");

  const snapshot = ent.sourceOrder.packageSnapshot as unknown as PackageSnapshot;
  assertWithinPackage(snapshot, input);
  const n = input.format.videoCount;
  if (n > ent.totalVideos - ent.usedVideos) {
    throw new DomainError(`Paketinde ${ent.totalVideos - ent.usedVideos} video hakkın kaldı.`, "VIDEO_COUNT");
  }

  const files = await loadAttachableFiles(db, userId, input.fileIds);
  const missing = missingRequiredItems({
    style: input.style.style,
    footageSource: input.style.footageSource,
    lyricsText: input.song.lyrics,
    fileKinds: files.map((f) => f.kind),
  });
  const status: OrderStatus = missing.length ? "AWAITING_FILES" : "NEW";

  const order = await withUniqueOrderNumber((number) =>
    db.$transaction(async (tx) => {
      // Koşullu artırım: eşzamanlı isteklerde hakların aşılmasını engeller
      const consumed = await tx.packageEntitlement.updateMany({
        where: { id: ent.id, status: "ACTIVE", usedVideos: { lte: ent.totalVideos - n } },
        data: { usedVideos: { increment: n } },
      });
      if (consumed.count !== 1) throw new DomainError("Yeterli video hakkın kalmadı.", "VIDEO_COUNT");

      // Bu siparişin videoları, paketin aylık teslim planında sıradaki yerlere düşer
      const after = await tx.packageEntitlement.findUniqueOrThrow({ where: { id: ent.id }, select: { usedVideos: true } });
      const firstIndex = after.usedVideos - n;
      const schedule = deliverySchedule(ent.startsAt, snapshot.videoCount, snapshot.bonusVideoCount ?? 0, snapshot.durationMonths);
      const dueDates = Array.from({ length: n }, (_, i) => batchDateForIndex(schedule, firstIndex + i));

      const song = await tx.song.create({ data: songData(userId, input) });
      const created = await tx.order.create({
        data: {
          ...orderData(input),
          number,
          userId,
          packageId: ent.packageId,
          songId: song.id,
          entitlementId: ent.id,
          kind: "ENTITLEMENT",
          status,
          packageSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          priceKurus: 0,
          currency: snapshot.currency,
          dueDate: dueDates.at(-1) ?? null,
        },
      });
      if (files.length) {
        const { count } = await tx.uploadedFile.updateMany({
          where: { id: { in: files.map((f) => f.id) }, orderId: null },
          data: { orderId: created.id, songId: song.id },
        });
        if (count !== files.length) throw new DomainError("Dosyalar başka bir siparişe bağlanmış.", "FILES");
      }
      await createProjects(tx, created.id, n, dueDates);
      await tx.orderEvent.create({
        data: {
          orderId: created.id,
          actorId: userId,
          type: "CREATED",
          toStatus: status,
          message: `Paket hakkından ${n} video kullanılarak sipariş oluşturuldu.`,
          visibleToCustomer: true,
        },
      });
      return created;
    }),
  );

  await notifyAdmins({
    title: `Yeni şarkı siparişi: ${order.number}`,
    body: `${input.song.artistName} – ${input.song.title} (${n} video). Durum: ${messages().enums.orderStatus[status]}.`,
    orderId: order.id,
    href: `/admin/siparisler/${order.number}`,
  });
  await notifyUser({
    userId,
    type: "ORDER_CREATED",
    orderId: order.id,
    title: `Siparişin alındı: ${order.number}`,
    body: missing.length
      ? "Siparişin oluşturuldu. Üretime başlayabilmemiz için eksik dosyalarını yüklemeyi unutma."
      : "Siparişin oluşturuldu. Ekibimiz dosyalarını inceleyip bir editöre atayacak.",
    email: {
      subject: `Siparişin alındı (${order.number})`,
      paragraphs: [
        `${input.song.artistName} – ${input.song.title} için siparişin oluşturuldu.`,
        missing.length
          ? "Üretime başlayabilmemiz için eksik dosyalarını müşteri panelinden yükleyebilirsin."
          : "Ekibimiz dosyalarını inceleyip siparişini bir editöre atayacak.",
      ],
      cta: { label: "Siparişi görüntüle", href: `/panel/siparislerim/${order.number}` },
    },
  });

  return order;
}

// ───────────────────────────── Dosya tamamlama ─────────────────────────────

/** Siparişin zorunlu dosyaları tamamlandıysa "Dosya Bekleniyor" durumundan çıkarır. */
export async function refreshFileRequirements(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      song: { select: { lyrics: true } },
      files: { where: { status: "UPLOADED" }, select: { kind: true } },
    },
  });
  if (!order || order.status !== "AWAITING_FILES") return order?.status ?? null;
  const missing = missingRequiredItems({
    style: order.style,
    footageSource: order.footageSource,
    lyricsText: order.song.lyrics,
    fileKinds: order.files.map((f) => f.kind),
  });
  if (missing.length) return order.status;

  const { count } = await db.order.updateMany({ where: { id: order.id, status: "AWAITING_FILES" }, data: { status: "NEW" } });
  if (count) {
    await db.orderEvent.create({
      data: {
        orderId: order.id,
        type: "STATUS_CHANGE",
        fromStatus: "AWAITING_FILES",
        toStatus: "NEW",
        message: "Gerekli dosyalar tamamlandı.",
        visibleToCustomer: true,
      },
    });
    await notifyAdmins({
      title: `Dosyalar tamamlandı: ${order.number}`,
      body: "Müşteri eksik dosyalarını yükledi. Sipariş editöre atanabilir.",
      orderId: order.id,
      href: `/admin/siparisler/${order.number}`,
    });
  }
  return "NEW" as const;
}

// ───────────────────────────── Durum değişiklikleri (admin) ─────────────────────────────

const CUSTOMER_EMAIL_STATUSES: OrderStatus[] = ["AWAITING_FILES", "IN_PROGRESS", "DELIVERED", "CANCELLED"];

export async function changeOrderStatus(orderId: string, to: OrderStatus, actorId: string, note?: string | null) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      assignments: { where: { active: true }, select: { id: true } },
      deliverables: { select: { id: true, releasedAt: true, projectId: true } },
      projects: { select: { id: true, deliveredAt: true } },
    },
  });
  if (!order) throw new DomainError("Sipariş bulunamadı.");
  const from = order.status;
  if (from === to) return order;
  if (!canTransition(from, to, "admin")) {
    const t = messages().enums.orderStatus;
    throw new DomainError(`"${t[from]}" durumundan "${t[to]}" durumuna geçilemez.`, "TRANSITION");
  }
  if (to === "ASSIGNED" && order.assignments.length === 0) {
    throw new DomainError("Önce siparişi bir editöre ata.", "TRANSITION");
  }
  if (to === "DELIVERED" && order.deliverables.length === 0) {
    throw new DomainError("Teslim için önce en az bir video yüklemelisin.", "TRANSITION");
  }

  const now = new Date();
  await db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: order.id, status: from },
      data: {
        status: to,
        ...(to === "DELIVERED" ? { deliveredAt: now } : {}),
        ...(to === "CANCELLED" ? { cancelledAt: now, cancelReason: note ?? null } : {}),
      },
    });
    if (updated.count !== 1) throw new DomainError("Sipariş bu sırada güncellendi. Sayfayı yenileyip tekrar dene.", "CONFLICT");

    if (to === "DELIVERED") {
      // Henüz yayınlanmamış teslim videoları müşteriye açılır
      await tx.deliverable.updateMany({ where: { orderId: order.id, releasedAt: null }, data: { releasedAt: now } });
      const projectIds = [...new Set(order.deliverables.map((d) => d.projectId))];
      await tx.project.updateMany({ where: { id: { in: projectIds }, deliveredAt: null }, data: { deliveredAt: now } });
    }

    if (to === "CANCELLED") {
      if (from === "PAYMENT_PENDING") {
        await tx.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });
      } else if (order.entitlementId) {
        // Teslim edilmemiş videoların hakları paket hakkına iade edilir
        const releasedProjects = new Set(order.deliverables.filter((d) => d.releasedAt).map((d) => d.projectId));
        const refundable = order.projects.filter((p) => !releasedProjects.has(p.id)).length;
        if (refundable > 0) {
          const ent = await tx.packageEntitlement.findUnique({ where: { id: order.entitlementId }, select: { usedVideos: true } });
          const decrement = Math.min(refundable, ent?.usedVideos ?? 0);
          if (decrement > 0) {
            await tx.packageEntitlement.update({
              where: { id: order.entitlementId },
              data: { usedVideos: { decrement } },
            });
          }
        }
      }
    }

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        actorId,
        type: "STATUS_CHANGE",
        fromStatus: from,
        toStatus: to,
        message: note ?? null,
        visibleToCustomer: true,
      },
    });
  });

  const t = messages().enums;
  await notifyUser({
    userId: order.userId,
    type: to === "DELIVERED" ? "DELIVERY" : to === "AWAITING_FILES" ? "FILES_NEEDED" : "STATUS_CHANGED",
    orderId: order.id,
    title: `${order.number}: ${t.orderStatus[to]}`,
    body: note?.trim() ? note : t.orderStatusHelp[to],
    email: CUSTOMER_EMAIL_STATUSES.includes(to)
      ? {
          subject: `Siparişinin durumu güncellendi: ${t.orderStatus[to]} (${order.number})`,
          paragraphs: [t.orderStatusHelp[to], ...(note?.trim() ? [`Ekibimizden not: ${note.trim()}`] : [])],
          cta: { label: "Siparişi görüntüle", href: `/panel/siparislerim/${order.number}` },
        }
      : undefined,
  });

  return db.order.findUnique({ where: { id: order.id } });
}

// ───────────────────────────── Editör ataması ─────────────────────────────

export async function assignEditor(orderId: string, editorId: string, actorId: string, note?: string | null) {
  const [order, editor] = await Promise.all([
    db.order.findUnique({ where: { id: orderId } }),
    db.editor.findUnique({ where: { id: editorId } }),
  ]);
  if (!order) throw new DomainError("Sipariş bulunamadı.");
  if (!editor || !editor.active) throw new DomainError("Editör bulunamadı veya aktif değil.");
  if (["PAYMENT_PENDING", "CANCELLED", "DELIVERED"].includes(order.status)) {
    throw new DomainError("Bu durumdaki siparişe editör atanamaz.", "TRANSITION");
  }

  await db.$transaction(async (tx) => {
    await tx.editorAssignment.updateMany({
      where: { orderId, active: true },
      data: { active: false, unassignedAt: new Date() },
    });
    await tx.editorAssignment.create({ data: { orderId, editorId, assignedById: actorId, note: note ?? null } });
    await tx.orderEvent.create({
      data: { orderId, actorId, type: "ASSIGNMENT", message: `Editör atandı: ${editor.name}`, visibleToCustomer: false },
    });
    if (order.status === "NEW") {
      const moved = await tx.order.updateMany({ where: { id: orderId, status: "NEW" }, data: { status: "ASSIGNED" } });
      if (moved.count) {
        await tx.orderEvent.create({
          data: { orderId, actorId, type: "STATUS_CHANGE", fromStatus: "NEW", toStatus: "ASSIGNED", visibleToCustomer: true },
        });
      }
    }
  });

  if (order.status === "NEW") {
    await notifyUser({
      userId: order.userId,
      type: "STATUS_CHANGED",
      orderId,
      title: `${order.number}: Editöre atandı`,
      body: messages().enums.orderStatusHelp.ASSIGNED,
    });
  }
}

export async function unassignEditor(orderId: string, actorId: string) {
  await db.$transaction(async (tx) => {
    const { count } = await tx.editorAssignment.updateMany({
      where: { orderId, active: true },
      data: { active: false, unassignedAt: new Date() },
    });
    if (count) {
      await tx.orderEvent.create({ data: { orderId, actorId, type: "ASSIGNMENT", message: "Editör ataması kaldırıldı." } });
    }
  });
}

export async function setDueDate(orderId: string, dueDate: Date | null, actorId: string) {
  const order = await db.order.update({ where: { id: orderId }, data: { dueDate } });
  await db.orderEvent.create({
    data: {
      orderId,
      actorId,
      type: "DUE_DATE",
      message: dueDate
        ? `Planlanan teslim tarihi: ${dueDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" })}`
        : "Planlanan teslim tarihi kaldırıldı.",
      visibleToCustomer: true,
    },
  });
  return order;
}

export async function sendCustomerNote(orderId: string, message: string, actorId: string) {
  const text = message.trim();
  if (text.length < 2) throw new DomainError("Not boş olamaz.");
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new DomainError("Sipariş bulunamadı.");
  await db.orderEvent.create({ data: { orderId, actorId, type: "NOTE", message: text, visibleToCustomer: true } });
  await notifyUser({
    userId: order.userId,
    type: "ADMIN_NOTE",
    orderId,
    title: `${order.number}: Ekibimizden bir not var`,
    body: text,
    email: {
      subject: `Siparişinle ilgili bir mesajımız var (${order.number})`,
      paragraphs: [text, "Yanıtını sipariş sayfandaki \"Mesajlar\" bölümünden yazabilirsin."],
      cta: { label: "Yanıtla", href: `/panel/siparislerim/${order.number}#mesajlar` },
    },
  });
}

/**
 * Müşterinin siparişle ilgili ekibe mesajı (ör. ekibin üretim öncesi sorularına yanıt).
 * Revizyon hakkı olmadığı için tercihler üretim başlamadan bu yolla netleştirilir.
 */
export async function sendCustomerMessage(userId: string, orderNumber: string, message: string) {
  const text = message.trim();
  if (text.length < 2) throw new DomainError("Mesajını yaz.");
  const order = await db.order.findFirst({ where: { number: orderNumber, userId }, select: { id: true, number: true, status: true } });
  if (!order) throw new DomainError("Sipariş bulunamadı.");
  if (order.status === "CANCELLED") throw new DomainError("İptal edilmiş sipariş için mesaj gönderilemez. İletişim sayfasından bize yazabilirsin.");
  await db.orderEvent.create({ data: { orderId: order.id, actorId: userId, type: "CUSTOMER_MESSAGE", message: text, visibleToCustomer: true } });
  await notifyAdmins({
    title: `Müşteri mesajı: ${order.number}`,
    body: text.slice(0, 500),
    orderId: order.id,
    href: `/admin/siparisler/${order.number}`,
  });
}

export async function addInternalNote(orderId: string, message: string, actorId: string) {
  const text = message.trim();
  if (text.length < 2) throw new DomainError("Not boş olamaz.");
  await db.orderEvent.create({ data: { orderId, actorId, type: "INTERNAL_NOTE", message: text, visibleToCustomer: false } });
}

/** Yanıt gerektirmeyen müşteri mesajını (ör. teşekkür) "yanıt bekliyor" listesinden çıkarır; müşteriye görünmez. */
export async function markMessagesHandled(orderId: string, actorId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) throw new DomainError("Sipariş bulunamadı.");
  await db.orderEvent.create({
    data: { orderId, actorId, type: "MESSAGE_HANDLED", message: "Müşteri mesajı yanıt gerektirmiyor olarak işaretlendi.", visibleToCustomer: false },
  });
}
