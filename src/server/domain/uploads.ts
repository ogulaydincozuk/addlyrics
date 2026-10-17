import "server-only";
import type { FileKind } from "@prisma/client";
import { ADMIN_FILE_KINDS, CUSTOMER_FILE_KINDS, TRIAL_FILE_KINDS, type FileKindValue } from "@/lib/enums";
import { CUSTOMER_EDITABLE_STATUSES } from "@/lib/order-status";
import type { SessionUser } from "../auth/session";
import { db } from "../db";
import { buildStorageKey, storage } from "../storage";
import { contentTypeFor, extensionOf, matchesSignature, validateDeclaredFile } from "../storage/file-rules";
import { DomainError } from "./errors";
import { refreshFileRequirements } from "./orders";

const MAX_PENDING_PER_DAY = 60;

export type InitUploadInput = {
  kind: FileKindValue;
  fileName: string;
  size: number;
  mimeType: string;
  orderId?: string | null;
  /** Eksik bilgi istenen deneme başvurusuna dosya ekleme */
  trialId?: string | null;
};

const TRIAL_CUSTOMER_EDITABLE = ["RECEIVED", "FILES_CHECK", "NEEDS_INFO"];

/** Yükleme kaydını oluşturur ve istemcinin dosyayı göndereceği hedefi döndürür. */
export async function initUpload(user: SessionUser, input: InitUploadInput) {
  const isAdminKind = (ADMIN_FILE_KINDS as readonly string[]).includes(input.kind);
  const isCustomerKind = (CUSTOMER_FILE_KINDS as readonly string[]).includes(input.kind);
  if (!isAdminKind && !isCustomerKind) throw new DomainError("Geçersiz dosya türü.");
  if (isAdminKind && user.role !== "ADMIN") throw new DomainError("Bu dosya türünü yükleme yetkin yok.", "FORBIDDEN");

  const fileName = input.fileName.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200) || "dosya";
  const check = validateDeclaredFile(input.kind, fileName, input.mimeType, input.size);
  if (!check.ok) throw new DomainError(check.error, "FILE_RULE");

  let orderId: string | null = null;
  let songId: string | null = null;
  let trialId: string | null = null;
  if (input.trialId) {
    if (!isCustomerKind) throw new DomainError("Bu dosya türü başvuruya eklenemez.", "FORBIDDEN");
    const trial = await db.trialApplication.findUnique({ where: { id: input.trialId }, select: { id: true, userId: true, status: true, songId: true } });
    if (!trial || (user.role !== "ADMIN" && trial.userId !== user.id)) throw new DomainError("Başvuru bulunamadı.", "FORBIDDEN");
    if (user.role !== "ADMIN" && !TRIAL_CUSTOMER_EDITABLE.includes(trial.status)) {
      throw new DomainError("Başvurun üretime alındığı için dosya eklenemez. Ekibimizle iletişime geç.", "FORBIDDEN");
    }
    trialId = trial.id;
    songId = trial.songId;
  }
  if (input.orderId) {
    const order = await db.order.findUnique({ where: { id: input.orderId }, select: { id: true, userId: true, status: true, songId: true } });
    if (!order) throw new DomainError("Sipariş bulunamadı.", "FORBIDDEN");
    if (user.role !== "ADMIN") {
      if (order.userId !== user.id) throw new DomainError("Sipariş bulunamadı.", "FORBIDDEN");
      if (!CUSTOMER_EDITABLE_STATUSES.includes(order.status)) {
        throw new DomainError("Bu aşamadaki siparişe dosya eklenemez. Ekibimizle iletişime geç.", "FORBIDDEN");
      }
    }
    // Teslim dosyaları siparişe ancak teslim kaydı oluşturulduğunda bağlanır
    if (input.kind !== "DELIVERABLE") {
      orderId = order.id;
      songId = order.songId;
    }
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pending = await db.uploadedFile.count({ where: { ownerId: user.id, status: "PENDING", createdAt: { gte: since } } });
  if (pending >= MAX_PENDING_PER_DAY && user.role !== "ADMIN") {
    throw new DomainError("Çok fazla tamamlanmamış yükleme var. Lütfen biraz sonra tekrar dene.", "RATE");
  }

  const contentType = contentTypeFor(input.kind, fileName, input.mimeType);
  const file = await db.uploadedFile.create({
    data: {
      ownerId: user.id,
      orderId,
      songId,
      trialId,
      kind: input.kind,
      // geçici anahtar; kimlik oluştuktan sonra güncellenir
      storageKey: `pending/${crypto.randomUUID()}`,
      originalName: fileName,
      mimeType: contentType,
      sizeBytes: BigInt(input.size),
    },
  });
  const isTrialKind = (TRIAL_FILE_KINDS as readonly string[]).includes(input.kind);
  const scope = input.kind === "DELIVERABLE" ? "deliverables" : isTrialKind ? "trials" : isAdminKind ? "portfolio" : "uploads";
  const key = buildStorageKey(scope, user.id, file.id, extensionOf(fileName));
  await db.uploadedFile.update({ where: { id: file.id }, data: { storageKey: key } });

  const target = await storage().createUploadTarget({ fileId: file.id, key, contentType, size: input.size });
  return { fileId: file.id, upload: target };
}

/** Yükleme bittikten sonra boyutu ve içerik imzasını doğrular. */
export async function completeUpload(user: SessionUser, fileId: string) {
  const file = await db.uploadedFile.findUnique({ where: { id: fileId } });
  if (!file || (file.ownerId !== user.id && user.role !== "ADMIN")) throw new DomainError("Dosya bulunamadı.", "NOT_FOUND");
  if (file.status === "UPLOADED") return serializeFile(file);
  if (file.status !== "PENDING") throw new DomainError("Bu yükleme artık geçerli değil.");

  const info = await storage().stat(file.storageKey);
  if (!info || info.size !== Number(file.sizeBytes)) {
    await db.uploadedFile.update({ where: { id: file.id }, data: { status: "FAILED" } });
    throw new DomainError("Dosya yüklemesi tamamlanmadı. Lütfen tekrar dene.", "INCOMPLETE");
  }
  const head = await storage().readHead(file.storageKey, 64);
  if (!matchesSignature(file.kind, head)) {
    await storage().delete(file.storageKey).catch(() => undefined);
    await db.uploadedFile.update({ where: { id: file.id }, data: { status: "FAILED" } });
    throw new DomainError("Dosyanın içeriği, uzantısıyla uyuşmuyor. Lütfen geçerli bir dosya seç.", "SIGNATURE");
  }

  const updated = await db.uploadedFile.update({ where: { id: file.id }, data: { status: "UPLOADED", uploadedAt: new Date() } });

  if (updated.trialId && (CUSTOMER_FILE_KINDS as readonly string[]).includes(updated.kind)) {
    await db.trialEvent.create({
      data: { trialId: updated.trialId, actorId: user.id, type: "FILE", message: `Dosya eklendi: ${updated.originalName}`, visibleToCustomer: true },
    });
  }

  if (updated.orderId && (CUSTOMER_FILE_KINDS as readonly string[]).includes(updated.kind)) {
    await db.orderEvent.create({
      data: {
        orderId: updated.orderId,
        actorId: user.id,
        type: "FILE",
        message: `Dosya yüklendi: ${updated.originalName}`,
        visibleToCustomer: true,
      },
    });
    await refreshFileRequirements(updated.orderId);
  }
  return serializeFile(updated);
}

/** Müşteri kendi dosyasını silebilir (sipariş üretime girmeden önce). */
export async function deleteUpload(user: SessionUser, fileId: string) {
  const file = await db.uploadedFile.findUnique({
    where: { id: fileId },
    include: { order: { select: { status: true } }, deliverable: { select: { id: true } }, trial: { select: { status: true } } },
  });
  if (!file || (file.ownerId !== user.id && user.role !== "ADMIN")) throw new DomainError("Dosya bulunamadı.", "NOT_FOUND");
  if (file.deliverable) throw new DomainError("Teslim edilmiş dosyalar silinemez.");
  if (user.role !== "ADMIN" && file.trial && !TRIAL_CUSTOMER_EDITABLE.includes(file.trial.status)) {
    throw new DomainError("Üretime alınmış başvurudaki dosyalar silinemez.");
  }
  if (user.role !== "ADMIN" && file.order && !CUSTOMER_EDITABLE_STATUSES.includes(file.order.status)) {
    throw new DomainError("Üretimi başlamış siparişteki dosyalar silinemez. Ekibimizle iletişime geç.");
  }
  await storage().delete(file.storageKey).catch(() => undefined);
  await db.uploadedFile.update({ where: { id: file.id }, data: { status: "DELETED", deletedAt: new Date(), orderId: null } });
}

/**
 * Dosyayı indirme/izleme yetkisi. Müşteriler yalnızca kendi yüklediği dosyalara ve yayınlanmış teslimlerine erişir.
 * Deneme ana dosyası yalnızca ödeme doğrulandıktan sonra teslim olarak yayınlandığında açılır; ön izlemeler
 * bu rotadan değil, süreli imzalı /api/deneme-medya bağlantısıyla sunulur.
 */
export async function canAccessFile(user: SessionUser, fileId: string) {
  const file = await db.uploadedFile.findUnique({
    where: { id: fileId },
    include: { deliverable: { select: { releasedAt: true, order: { select: { userId: true } } } } },
  });
  if (!file || file.status !== "UPLOADED") return null;
  if (user.role === "ADMIN") return file;
  if (file.deliverable) {
    return file.deliverable.releasedAt && file.deliverable.order.userId === user.id ? file : null;
  }
  if ((ADMIN_FILE_KINDS as readonly string[]).includes(file.kind)) return null;
  return file.ownerId === user.id ? file : null;
}

export function serializeFile(file: { id: string; kind: FileKind; originalName: string; sizeBytes: bigint; status: string; mimeType: string }) {
  return {
    id: file.id,
    kind: file.kind,
    name: file.originalName,
    size: Number(file.sizeBytes),
    status: file.status,
    mimeType: file.mimeType,
  };
}
