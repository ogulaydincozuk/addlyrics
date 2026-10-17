import "server-only";
import { db } from "../db";
import { notifyUser } from "../notify";
import { DomainError, isUniqueViolation } from "./errors";

/** Editörün hazırladığı videoyu ilgili proje (video işi) ile ilişkilendirir. Müşteriye henüz açılmaz. */
export async function addDeliverable(projectId: string, fileId: string, actorId: string, note?: string | null) {
  const project = await db.project.findUnique({ where: { id: projectId }, include: { order: true } });
  if (!project) throw new DomainError("Video işi bulunamadı.");
  if (["PAYMENT_PENDING", "CANCELLED"].includes(project.order.status)) {
    throw new DomainError("Bu siparişe teslim videosu eklenemez.");
  }
  const file = await db.uploadedFile.findFirst({
    where: { id: fileId, kind: "DELIVERABLE", status: "UPLOADED" },
    include: { deliverable: { select: { id: true } } },
  });
  if (!file) throw new DomainError("Yüklenen video bulunamadı veya yükleme tamamlanmadı.");
  if (file.deliverable) throw new DomainError("Bu dosya zaten bir teslime bağlı.");

  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await db.deliverable.findFirst({ where: { projectId }, orderBy: { version: "desc" }, select: { version: true } });
    try {
      const deliverable = await db.$transaction(async (tx) => {
        const d = await tx.deliverable.create({
          data: {
            projectId,
            orderId: project.orderId,
            fileId,
            version: (last?.version ?? 0) + 1,
            note: note?.trim() || null,
            uploadedById: actorId,
          },
        });
        await tx.uploadedFile.update({ where: { id: fileId }, data: { orderId: project.orderId } });
        await tx.orderEvent.create({
          data: {
            orderId: project.orderId,
            actorId,
            type: "DELIVERABLE",
            message: `${project.title} için v${d.version} yüklendi (henüz müşteriye açılmadı).`,
          },
        });
        return d;
      });
      return deliverable;
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 2) continue;
      throw err;
    }
  }
  throw new DomainError("Teslim kaydı oluşturulamadı, tekrar dene.");
}

/** Teslim videosunu müşteriye açar. */
export async function releaseDeliverable(deliverableId: string, actorId: string) {
  const d = await db.deliverable.findUnique({ where: { id: deliverableId }, include: { project: true, order: true } });
  if (!d) throw new DomainError("Teslim bulunamadı.");
  if (d.releasedAt) return d;
  if (d.order.status === "CANCELLED") throw new DomainError("İptal edilmiş siparişte teslim yapılamaz.");
  // Ücretli tam sürümler yalnızca doğrulanmış (ve iade edilmemiş) ödemeden sonra açılır
  if (d.order.kind === "PURCHASE") {
    const paid = await db.payment.count({ where: { orderId: d.orderId, status: "SUCCEEDED" } });
    if (!paid) throw new DomainError("Ödemesi doğrulanmamış siparişte teslim yapılamaz.");
  }
  const now = new Date();
  await db.$transaction([
    db.deliverable.update({ where: { id: d.id }, data: { releasedAt: now } }),
    db.project.updateMany({ where: { id: d.projectId, deliveredAt: null }, data: { deliveredAt: now } }),
    // Deneme videosunun tam sürümü teslim edildi
    ...(d.project.trialVideoId
      ? [db.trialVideo.updateMany({ where: { id: d.project.trialVideoId, status: "PREVIEW_READY" }, data: { status: "COMPLETED" } })]
      : []),
    db.orderEvent.create({
      data: {
        orderId: d.orderId,
        actorId,
        type: "DELIVERY",
        message: `${d.project.title} teslim edildi (v${d.version}).`,
        visibleToCustomer: true,
      },
    }),
  ]);
  if (d.project.trialVideoId) {
    const tv = await db.trialVideo.findUnique({ where: { id: d.project.trialVideoId }, select: { trialId: true } });
    if (tv) {
      const remaining = await db.trialVideo.count({ where: { trialId: tv.trialId, status: { not: "COMPLETED" } } });
      if (!remaining) {
        await db.trialApplication.updateMany({ where: { id: tv.trialId, status: { not: "COMPLETED" } }, data: { status: "COMPLETED" } });
        await db.trialEvent.create({
          data: { trialId: tv.trialId, actorId, type: "COMPLETED", message: "Üç deneme videosunun tam sürümleri teslim edildi.", visibleToCustomer: true },
        });
      }
    }
  }
  await notifyUser({
    userId: d.order.userId,
    type: "DELIVERY",
    orderId: d.orderId,
    title: `${d.order.number}: ${d.project.title} teslim edildi`,
    body: "Yeni videon müşteri panelinde seni bekliyor.",
    email: {
      subject: `Videon hazır: ${d.project.title} (${d.order.number})`,
      paragraphs: ["Editörümüzün hazırladığı videon teslim edildi. Panelden izleyebilir ve indirebilirsin."],
      cta: { label: "Videonu izle", href: `/panel/siparislerim/${d.order.number}` },
    },
  });
  return d;
}

export async function updateProjectPlan(
  projectId: string,
  data: { format?: "VERTICAL" | "HORIZONTAL" | "SQUARE" | null; dueDate?: Date | null; title?: string },
) {
  return db.project.update({
    where: { id: projectId },
    data: {
      ...(data.format !== undefined ? { format: data.format } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      ...(data.title ? { title: data.title.slice(0, 80) } : {}),
    },
  });
}
