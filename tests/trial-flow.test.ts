import { beforeEach, describe, expect, it } from "vitest";
import { addBusinessDays } from "@/lib/delivery-plan";
import type { TrialInput } from "@/lib/validation";
import { db } from "@/server/db";
import { releaseDeliverable } from "@/server/domain/deliveries";
import { createTrialPurchaseOrder } from "@/server/domain/orders";
import {
  approveTrialPreview,
  attachTrialMaster,
  attachTrialPreview,
  checkTrialDelays,
  createTrialApplication,
  moveTrialVideo,
  requestTrialInfo,
  resubmitTrial,
  retryTrialVideo,
  trialEligibility,
  verifyTrialFiles,
} from "@/server/domain/trials";
import { canAccessFile } from "@/server/domain/uploads";
import { sentEmails } from "@/server/email";
import { verifyTrialMediaToken } from "@/server/media-sign";
import { confirmByToken, finalizeSuccessfulPayment, markPaymentRefunded, startPayment } from "@/server/payments/service";
import { getCustomerTrial } from "@/server/queries/trials";
import { billing, createPackage, createUser, createVerifiedUser, resetDb, sessionOf, uploadedFile } from "./helpers";

const LYRICS = "Gece boyunca aynı sokaklar\nKulaklıkta tek bir ses yankılanır";

function trialInput(fileIds: string[], over: Partial<TrialInput> = {}): TrialInput {
  return {
    song: { artistName: "Test Sanatçı", title: "Deneme Şarkısı", releaseStatus: "UPCOMING", language: "Türkçe", lyrics: LYRICS },
    formats: ["VERTICAL"],
    fileIds,
    rightsConfirmed: true,
    materialsMatchConfirmed: true,
    termsAccepted: true,
    ...over,
  };
}

async function submittedTrial() {
  const user = await createVerifiedUser();
  const audio = await uploadedFile(user.id, "SONG_AUDIO", 3_000_000);
  const created = await createTrialApplication(user.id, trialInput([audio.id]));
  return { user, audio, created };
}

/** Dosyaları onaylanmış, üç ön izlemesi kalite kontrolden geçmiş deneme */
async function readyTrial() {
  const { user, audio, created } = await submittedTrial();
  const admin = await createUser("ADMIN");
  await verifyTrialFiles(admin.id, created.id);
  const videos = await db.trialVideo.findMany({ where: { trialId: created.id }, orderBy: { sequence: "asc" } });
  for (const v of videos) {
    const master = await uploadedFile(admin.id, "TRIAL_MASTER", 50_000_000);
    await attachTrialMaster(admin.id, v.id, master.id);
    const preview = await uploadedFile(admin.id, "TRIAL_PREVIEW", 2_000_000);
    await attachTrialPreview(admin.id, v.id, preview.id, null, true);
    await approveTrialPreview(admin.id, v.id);
  }
  return { user, admin, audio, trialId: created.id };
}

async function pay(orderNumber: string, userId: string) {
  const started = await startPayment(orderNumber, userId, billing, "127.0.0.1");
  const payment = await db.payment.update({ where: { id: started.paymentId }, data: { mockOutcome: "success" } });
  await confirmByToken("MOCK", payment.providerToken!);
  return payment;
}

describe("ücretsiz deneme", () => {
  beforeEach(async () => {
    await resetDb();
    sentEmails.length = 0;
  });

  it("e-posta ve telefon doğrulanmadan deneme başlatılamaz", async () => {
    const user = await createUser();
    const eligibility = await trialEligibility(user.id);
    expect(eligibility).toMatchObject({ ok: false, reason: "EMAIL" });
    await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    expect(await trialEligibility(user.id)).toMatchObject({ ok: false, reason: "PHONE" });
    const audio = await uploadedFile(user.id, "SONG_AUDIO", 3_000_000);
    await expect(createTrialApplication(user.id, trialInput([audio.id]))).rejects.toThrow(/telefon/i);
  });

  it("eksik veya hatalı dosyada başvuru oluşmaz ve kuyruğa alınmaz", async () => {
    const user = await createVerifiedUser();
    const lyricsOnly = await uploadedFile(user.id, "LYRICS");
    await expect(createTrialApplication(user.id, trialInput([lyricsOnly.id]))).rejects.toThrow(/ses dosyası/);
    const tinyAudio = await uploadedFile(user.id, "SONG_AUDIO", 2_000);
    await expect(createTrialApplication(user.id, trialInput([tinyAudio.id]))).rejects.toThrow(/çok küçük/);
    const audio = await uploadedFile(user.id, "SONG_AUDIO", 3_000_000);
    await expect(createTrialApplication(user.id, trialInput([audio.id], { song: { ...trialInput([]).song, lyrics: "kısa" } }))).rejects.toThrow(/kısa/);
    expect(await db.trialApplication.count()).toBe(0);
  });

  it("başvuru dosya kontrolüne düşer; ön izleme süresi dosyalar onaylanınca başlar", async () => {
    const { created } = await submittedTrial();
    const trial = await db.trialApplication.findUniqueOrThrow({ where: { id: created.id }, include: { videos: true } });
    expect(trial.status).toBe("FILES_CHECK");
    expect(trial.previewDueAt).toBeNull();
    expect(trial.videos).toHaveLength(3);
    expect(new Set(trial.videos.map((v) => v.style)).size).toBe(3); // üç farklı yaklaşım

    const admin = await createUser("ADMIN");
    const before = Date.now();
    await verifyTrialFiles(admin.id, created.id);
    const queued = await db.trialApplication.findUniqueOrThrow({ where: { id: created.id }, include: { videos: true } });
    expect(queued.status).toBe("QUEUED");
    expect(queued.videos.every((v) => v.status === "QUEUED")).toBe(true);
    const due = queued.previewDueAt!.getTime() - before;
    expect(due).toBeGreaterThan(23.9 * 3600 * 1000);
    expect(due).toBeLessThan(24.1 * 3600 * 1000);
  });

  it("ekip eksik bilgi isteyebilir; müşteri düzeltip yeniden gönderir", async () => {
    const { user, created } = await submittedTrial();
    const admin = await createUser("ADMIN");
    await requestTrialInfo(admin.id, created.id, "Ses dosyası ile sözler farklı şarkıya ait görünüyor.");
    expect((await db.trialApplication.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("NEEDS_INFO");
    expect(await db.notification.count({ where: { userId: user.id, type: "FILES_NEEDED" } })).toBe(1);
    // Eksik bilgi beklerken üretim başlatılamaz
    await expect(verifyTrialFiles(admin.id, created.id)).rejects.toThrow();
    await resubmitTrial(user.id, { lyrics: `${LYRICS}\nSabaha kadar bu şarkı benimle` });
    expect((await db.trialApplication.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("FILES_CHECK");
  });

  it("üç ön izleme hazır olunca müşteri bir kez bilgilendirilir", async () => {
    const { user, trialId } = await readyTrial();
    const trial = await db.trialApplication.findUniqueOrThrow({ where: { id: trialId } });
    expect(trial.status).toBe("PREVIEW_READY");
    expect(trial.previewsReadyAt).not.toBeNull();
    expect(await db.notification.count({ where: { userId: user.id, type: "PREVIEWS_READY" } })).toBe(1);
    expect(sentEmails.filter((e) => e.to === user.email && /Ön izlemelerin hazır/.test(e.subject))).toHaveLength(1);
  });

  it("ön izlemeler yalnızca başvuru sahibine süreli imzalı bağlantıyla açılır; ana dosya ödemesiz açılmaz", async () => {
    const { user, trialId } = await readyTrial();
    const other = await createVerifiedUser();
    const mine = await getCustomerTrial(user.id);
    expect(mine?.videos.every((v) => v.previewUrl)).toBe(true);
    expect(await getCustomerTrial(other.id)).toBeNull();

    const v = mine!.videos[0]!;
    const token = new URL(v.previewUrl!, "http://x").searchParams.get("t");
    expect(verifyTrialMediaToken(token, v.id, "preview")?.userId).toBe(user.id);
    expect(verifyTrialMediaToken(token, mine!.videos[1]!.id, "preview")).toBeNull();
    expect(verifyTrialMediaToken(token, v.id, "poster")).toBeNull();

    const video = await db.trialVideo.findFirstOrThrow({ where: { trialId }, orderBy: { sequence: "asc" } });
    expect(await canAccessFile(sessionOf(user), video.masterFileId!)).toBeNull();
    expect(await canAccessFile(sessionOf(user), video.previewFileId!)).toBeNull(); // yalnızca imzalı medya rotasından
    expect(await canAccessFile(sessionOf(other), video.masterFileId!)).toBeNull();
  });

  it("30 videoluk pakette 3 deneme + 27 yeni video; tam sürümler ödeme doğrulanınca açılır", async () => {
    const { user, trialId, audio } = await readyTrial();
    const pkg = await createPackage({ videoCount: 30, priceKurus: 320000, durationMonths: 1 });
    const order = await createTrialPurchaseOrder(user.id, pkg.slug);
    expect(order.videoCount).toBe(30);
    expect(await db.project.count({ where: { orderId: order.id } })).toBe(0);
    expect(await db.deliverable.count()).toBe(0);

    const payment = await pay(order.number, user.id);
    const paidOrder = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { projects: true, deliverables: true } });
    const ent = await db.packageEntitlement.findUniqueOrThrow({ where: { sourceOrderId: order.id } });
    expect(ent.totalVideos).toBe(30);
    expect(ent.usedVideos).toBe(30);
    expect(paidOrder.projects).toHaveLength(30);
    const fromTrial = paidOrder.projects.filter((p) => p.trialVideoId);
    expect(fromTrial).toHaveLength(3);
    expect(paidOrder.projects.filter((p) => !p.trialVideoId)).toHaveLength(27);
    // Kalan 27 video: ödeme onayından itibaren 5 iş günü
    const due = addBusinessDays(payment.createdAt, 5).getTime();
    for (const p of paidOrder.projects.filter((x) => !x.trialVideoId)) expect(Math.abs(p.dueDate!.getTime() - due)).toBeLessThan(24 * 3600 * 1000);
    // Denemedeki dosyalar ücretli siparişe bağlandı (yeniden yükleme yok)
    expect((await db.uploadedFile.findUniqueOrThrow({ where: { id: audio.id } })).orderId).toBe(order.id);
    expect(paidOrder.status).toBe("NEW");

    // Ana dosyalar teslim kaydına bağlandı ama son kalite kontrolden önce kapalı
    expect(paidOrder.deliverables).toHaveLength(3);
    const master = paidOrder.deliverables[0]!.fileId;
    expect(await canAccessFile(sessionOf(user), master)).toBeNull();
    const admin = await db.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    for (const d of paidOrder.deliverables) await releaseDeliverable(d.id, admin.id);
    expect(await canAccessFile(sessionOf(user), master)).not.toBeNull();
    const trial = await db.trialApplication.findUniqueOrThrow({ where: { id: trialId }, include: { videos: true } });
    expect(trial.convertedOrderId).toBe(order.id);
    expect(trial.status).toBe("COMPLETED");
    expect(trial.videos.every((v) => v.status === "COMPLETED")).toBe(true);
  });

  it("aynı ödeme bildirimi tekrar geldiğinde haklar, projeler ve teslimler tekrar oluşmaz", async () => {
    const { user } = await readyTrial();
    const pkg = await createPackage({ videoCount: 30, priceKurus: 320000, durationMonths: 1 });
    const order = await createTrialPurchaseOrder(user.id, pkg.slug);
    const payment = await pay(order.number, user.id);
    await confirmByToken("MOCK", payment.providerToken!);
    await finalizeSuccessfulPayment(payment.id, { status: "SUCCEEDED", amountKurus: payment.amountKurus, currency: "TRY", raw: {} });
    expect(await db.packageEntitlement.count()).toBe(1);
    expect(await db.project.count({ where: { orderId: order.id } })).toBe(30);
    expect(await db.deliverable.count({ where: { orderId: order.id } })).toBe(3);
    expect((await db.packageEntitlement.findFirstOrThrow()).usedVideos).toBe(30);
  });

  it("iade edilen siparişte tam sürüm yayınlanamaz", async () => {
    const { user } = await readyTrial();
    const pkg = await createPackage({ videoCount: 30, priceKurus: 320000, durationMonths: 1 });
    const order = await createTrialPurchaseOrder(user.id, pkg.slug);
    const payment = await pay(order.number, user.id);
    await markPaymentRefunded(payment.id, null, "Test iadesi");
    const d = await db.deliverable.findFirstOrThrow({ where: { orderId: order.id } });
    const admin = await db.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    await expect(releaseDeliverable(d.id, admin.id)).rejects.toThrow(/doğrulanmamış/);
  });

  it("deneme videoları pakete dahil değilse pakete ek sayılır", async () => {
    const { user } = await readyTrial();
    const pkg = await createPackage({ videoCount: 30, priceKurus: 320000, durationMonths: 1, trialCountsTowardPackage: false });
    const order = await createTrialPurchaseOrder(user.id, pkg.slug);
    expect(order.videoCount).toBe(33);
    await pay(order.number, user.id);
    const ent = await db.packageEntitlement.findUniqueOrThrow({ where: { sourceOrderId: order.id } });
    expect(ent.totalVideos).toBe(33);
    expect(ent.usedVideos).toBe(33);
  });

  it("ön izlemeler hazır olmadan satın almaya dönüştürülemez", async () => {
    const { user } = await submittedTrial();
    const pkg = await createPackage({ videoCount: 30, priceKurus: 320000 });
    await expect(createTrialPurchaseOrder(user.id, pkg.slug)).rejects.toThrow(/hazır/);
  });

  it("hedef süre aşılınca ekip ve müşteri bir kez uyarılır", async () => {
    const { user, created } = await submittedTrial();
    const admin = await createUser("ADMIN");
    await verifyTrialFiles(admin.id, created.id);
    await db.trialApplication.update({ where: { id: created.id }, data: { previewDueAt: new Date(Date.now() - 60_000) } });
    expect(await checkTrialDelays()).toBe(1);
    expect(await checkTrialDelays()).toBe(0);
    expect(await db.notification.count({ where: { userId: admin.id, type: "ADMIN_ALERT", title: { contains: "gecikti" } } })).toBe(1);
    expect(await db.notification.count({ where: { userId: user.id, title: { contains: "gecikecek" } } })).toBe(1);
  });

  it("üretim hatası başvuruyu 'Hata oluştu' yapar; yeniden kuyruğa alınabilir", async () => {
    const { created } = await submittedTrial();
    const admin = await createUser("ADMIN");
    await verifyTrialFiles(admin.id, created.id);
    const v = await db.trialVideo.findFirstOrThrow({ where: { trialId: created.id } });
    await moveTrialVideo(admin.id, v.id, "FAILED", "Kaynak dosya bozuk");
    expect((await db.trialApplication.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("FAILED");
    expect((await db.trialVideo.findUniqueOrThrow({ where: { id: v.id } })).processingError).toMatch(/bozuk/);
    await retryTrialVideo(admin.id, v.id);
    expect((await db.trialVideo.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("QUEUED");
    expect((await db.trialApplication.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("QUEUED");
  });

  it("aynı kullanıcı ikinci deneme başlatamaz", async () => {
    const { user } = await submittedTrial();
    const audio = await uploadedFile(user.id, "SONG_AUDIO", 3_000_000);
    await expect(createTrialApplication(user.id, trialInput([audio.id]))).rejects.toThrow(/zaten/);
  });
});
