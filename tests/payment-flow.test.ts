import { beforeEach, describe, expect, it } from "vitest";
import { deliveryDates } from "@/lib/delivery-plan";
import { db } from "@/server/db";
import { createEntitlementOrder, createPurchaseOrder } from "@/server/domain/orders";
import {
  applyVerifiedResult,
  confirmByToken,
  finalizeSuccessfulPayment,
  markPaymentRefunded,
  recordWebhookEvent,
  startPayment,
} from "@/server/payments/service";
import { billing, createPackage, createUser, orderInput, resetDb, uploadedFile } from "./helpers";

async function paidOrderFixture(opts: { videoCount?: number; withAudio?: boolean } = {}) {
  const user = await createUser();
  const pkg = await createPackage();
  const fileIds = opts.withAudio === false ? [] : [(await uploadedFile(user.id, "SONG_AUDIO")).id];
  const order = await createPurchaseOrder(
    user.id,
    pkg.slug,
    orderInput({ fileIds, format: { formats: ["VERTICAL"], platforms: ["TIKTOK"], videoCount: opts.videoCount ?? 2 } }),
  );
  const started = await startPayment(order.number, user.id, billing, "127.0.0.1");
  const payment = await db.payment.findUniqueOrThrow({ where: { id: started.paymentId } });
  return { user, pkg, order, payment, started };
}

describe("ödeme → paket hakkı akışı", () => {
  beforeEach(resetDb);

  it("ödeme beklenen siparişte hak tanımlanmaz", async () => {
    const { order, payment, started } = await paidOrderFixture();
    expect(order.status).toBe("PAYMENT_PENDING");
    expect(order.priceKurus).toBe(250000);
    expect(payment.amountKurus).toBe(250000);
    expect(started.checkoutUrl).toMatch(/^\/odeme\/test\/mock_/);
    expect(await db.packageEntitlement.count()).toBe(0);
  });

  it("başarılı ödeme hakkı tanımlar, projeleri oluşturur ve tekrar gelen bildirimi yok sayar", async () => {
    const { order, payment } = await paidOrderFixture({ videoCount: 3 });
    await db.payment.update({ where: { id: payment.id }, data: { mockOutcome: "success" } });

    await confirmByToken("MOCK", payment.providerToken!);
    // Aynı dönüş / webhook ikinci kez gelir
    await confirmByToken("MOCK", payment.providerToken!);

    const ent = await db.packageEntitlement.findMany({ where: { sourceOrderId: order.id } });
    expect(ent).toHaveLength(1);
    expect(ent[0]!.totalVideos).toBe(4);
    expect(ent[0]!.usedVideos).toBe(3);
    expect(ent[0]!.endsAt.getTime()).toBeGreaterThan(ent[0]!.startsAt.getTime());

    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { projects: true } });
    expect(updated.status).toBe("NEW"); // şarkı dosyası ve sözler mevcut
    expect(updated.entitlementId).toBe(ent[0]!.id);
    expect(updated.projects).toHaveLength(3);
    // Aylık teslim planı: videolar paketin ilk teslim tarihine planlanır (ödeme gününe göre kural: src/lib/delivery-plan.ts)
    const firstBatch = deliveryDates(ent[0]!.startsAt, 1)[0]!;
    for (const p of updated.projects) {
      expect(p.dueDate?.getTime()).toBe(firstBatch.getTime());
      expect(p.dueDate!.getTime()).toBeGreaterThan(ent[0]!.startsAt.getTime());
    }
    expect(updated.dueDate?.getTime()).toBe(updated.projects.at(-1)!.dueDate!.getTime());
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("SUCCEEDED");
  });

  it("eksik dosya varsa sipariş 'Dosya Bekleniyor' durumuna geçer", async () => {
    const { order, payment } = await paidOrderFixture({ withAudio: false });
    await db.payment.update({ where: { id: payment.id }, data: { mockOutcome: "success" } });
    await confirmByToken("MOCK", payment.providerToken!);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("AWAITING_FILES");
  });

  it("başarısız ödemede hak tanımlanmaz ve sipariş ödeme bekler", async () => {
    const { order, payment } = await paidOrderFixture();
    await db.payment.update({ where: { id: payment.id }, data: { mockOutcome: "failure" } });
    await confirmByToken("MOCK", payment.providerToken!);
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("FAILED");
    expect(await db.packageEntitlement.count()).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAYMENT_PENDING");
  });

  it("tutar uyuşmazlığında hak tanımlanmaz", async () => {
    const { payment } = await paidOrderFixture();
    const full = await db.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { order: true } });
    const result = await applyVerifiedResult(full, {
      status: "SUCCEEDED",
      conversationId: payment.conversationId,
      amountKurus: 100, // eksik ödeme
      currency: "TRY",
      raw: {},
    });
    expect(result).toBe("FAILED");
    expect(await db.packageEntitlement.count()).toBe(0);
  });

  it("eşzamanlı iki onay yalnızca bir hak oluşturur", async () => {
    const { payment } = await paidOrderFixture();
    const result = { status: "SUCCEEDED" as const, conversationId: payment.conversationId, amountKurus: 250000, currency: "TRY", raw: {} };
    const outcomes = await Promise.all([finalizeSuccessfulPayment(payment.id, result), finalizeSuccessfulPayment(payment.id, result)]);
    expect(outcomes.filter((o) => o === "granted")).toHaveLength(1);
    expect(await db.packageEntitlement.count()).toBe(1);
  });

  it("iade, paket hakkını iptal eder ve yeni sipariş açılmasını engeller", async () => {
    const { user, payment } = await paidOrderFixture();
    await db.payment.update({ where: { id: payment.id }, data: { mockOutcome: "success" } });
    await confirmByToken("MOCK", payment.providerToken!);
    await markPaymentRefunded(payment.id, null, "Test iadesi");

    const ent = await db.packageEntitlement.findFirstOrThrow({ where: { paymentId: payment.id } });
    expect(ent.status).toBe("REVOKED");
    await expect(createEntitlementOrder(user.id, ent.id, orderInput())).rejects.toThrow(/aktif değil/);
  });

  it("mevcut haktan sipariş kalan hakkı düşer ve aşımı engeller", async () => {
    const { user, payment } = await paidOrderFixture({ videoCount: 1 });
    await db.payment.update({ where: { id: payment.id }, data: { mockOutcome: "success" } });
    await confirmByToken("MOCK", payment.providerToken!);
    const ent = await db.packageEntitlement.findFirstOrThrow({ where: { paymentId: payment.id } });

    const second = await createEntitlementOrder(
      user.id,
      ent.id,
      orderInput({ format: { formats: ["VERTICAL"], platforms: ["TIKTOK"], videoCount: 3 } }),
    );
    expect(second.status).toBe("AWAITING_FILES"); // şarkı dosyası yok
    expect((await db.packageEntitlement.findUniqueOrThrow({ where: { id: ent.id } })).usedVideos).toBe(4);

    await expect(createEntitlementOrder(user.id, ent.id, orderInput({ format: { formats: ["VERTICAL"], platforms: ["TIKTOK"], videoCount: 1 } }))).rejects.toThrow(
      /hakkın kaldı|kalmadı/,
    );
  });

  it("başka kullanıcının paket hakkı kullanılamaz", async () => {
    const { payment } = await paidOrderFixture();
    await db.payment.update({ where: { id: payment.id }, data: { mockOutcome: "success" } });
    await confirmByToken("MOCK", payment.providerToken!);
    const ent = await db.packageEntitlement.findFirstOrThrow({ where: { paymentId: payment.id } });
    const stranger = await createUser();
    await expect(createEntitlementOrder(stranger.id, ent.id, orderInput())).rejects.toThrow(/bulunamadı/);
  });

  it("fiyatı belirlenmemiş paket satın alınamaz", async () => {
    const user = await createUser();
    const pkg = await createPackage({ priceKurus: null });
    await expect(createPurchaseOrder(user.id, pkg.slug, orderInput())).rejects.toThrow(/fiyatı/);
  });

  it("pakete dahil olmayan format reddedilir", async () => {
    const user = await createUser();
    const pkg = await createPackage({ includedFormats: ["VERTICAL"] });
    await expect(
      createPurchaseOrder(user.id, pkg.slug, orderInput({ format: { formats: ["SQUARE"], platforms: ["TIKTOK"], videoCount: 1 } })),
    ).rejects.toThrow(/dahil değil/);
  });

  it("başka kullanıcının dosyası siparişe eklenemez", async () => {
    const owner = await createUser();
    const other = await createUser();
    const pkg = await createPackage();
    const file = await uploadedFile(owner.id, "SONG_AUDIO");
    await expect(createPurchaseOrder(other.id, pkg.slug, orderInput({ fileIds: [file.id] }))).rejects.toThrow(/dosyalar bulunamadı/i);
  });

  it("webhook olayı aynı anahtarla ikinci kez işlenmez", async () => {
    const first = await recordWebhookEvent("IYZICO", "evt-1", "test", { a: 1 });
    expect(first.isNew).toBe(true);
    await db.webhookEvent.update({ where: { id: first.id! }, data: { processedAt: new Date() } });
    const second = await recordWebhookEvent("IYZICO", "evt-1", "test", { a: 1 });
    expect(second.isNew).toBe(false);
  });
});
