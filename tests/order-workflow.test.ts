import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { addDeliverable, releaseDeliverable } from "@/server/domain/deliveries";
import { canAccessFile } from "@/server/domain/uploads";
import { assignEditor, changeOrderStatus, createPurchaseOrder, refreshFileRequirements, sendCustomerMessage } from "@/server/domain/orders";
import { confirmByToken, startPayment } from "@/server/payments/service";
import { billing, createPackage, createUser, orderInput, resetDb, uploadedFile } from "./helpers";

async function paidOrder(videoCount = 2) {
  const customer = await createUser();
  const admin = await createUser("ADMIN");
  const pkg = await createPackage();
  const audio = await uploadedFile(customer.id, "SONG_AUDIO");
  const order = await createPurchaseOrder(
    customer.id,
    pkg.slug,
    orderInput({ fileIds: [audio.id], format: { formats: ["VERTICAL"], platforms: ["TIKTOK"], videoCount } }),
  );
  const { paymentId } = await startPayment(order.number, customer.id, billing, "127.0.0.1");
  const payment = await db.payment.update({ where: { id: paymentId }, data: { mockOutcome: "success" } });
  await confirmByToken("MOCK", payment.providerToken!);
  const editor = await db.editor.create({ data: { name: "Editör A", specialties: ["MINIMAL"] } });
  return { customer, admin, pkg, order, editor };
}

describe("editör iş akışı ve teslim", () => {
  beforeEach(resetDb);

  it("editör ataması siparişi 'Editöre Atandı' durumuna taşır", async () => {
    const { order, editor, admin } = await paidOrder();
    await assignEditor(order.id, editor.id, admin.id);
    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { assignments: true } });
    expect(updated.status).toBe("ASSIGNED");
    expect(updated.assignments.filter((a) => a.active)).toHaveLength(1);

    // Yeniden atama önceki atamayı pasifleştirir
    const editorB = await db.editor.create({ data: { name: "Editör B" } });
    await assignEditor(order.id, editorB.id, admin.id);
    const again = await db.editorAssignment.findMany({ where: { orderId: order.id } });
    expect(again.filter((a) => a.active).map((a) => a.editorId)).toEqual([editorB.id]);
  });

  it("izin verilmeyen durum geçişi reddedilir ve ödeme beklenen sipariş elle ödenmiş yapılamaz", async () => {
    const { order, admin } = await paidOrder();
    await expect(changeOrderStatus(order.id, "DELIVERED", admin.id)).rejects.toThrow(/geçilemez/);

    const customer = await createUser();
    const pkg = await createPackage();
    const pending = await createPurchaseOrder(customer.id, pkg.slug, orderInput());
    await expect(changeOrderStatus(pending.id, "NEW", admin.id)).rejects.toThrow(/geçilemez/);
  });

  it("teslim videosu müşteriye ancak yayınlandığında açılır; teslim edilen sipariş son durumdur", async () => {
    const { order, admin, customer } = await paidOrder(1);
    const project = await db.project.findFirstOrThrow({ where: { orderId: order.id } });
    const file = await uploadedFile(admin.id, "DELIVERABLE");
    const deliverable = await addDeliverable(project.id, file.id, admin.id, "İlk sürüm");
    expect(deliverable.releasedAt).toBeNull();

    const asCustomer = { id: customer.id, email: customer.email, name: customer.name, artistName: null, role: "CUSTOMER" as const };
    expect(await canAccessFile(asCustomer, file.id)).toBeNull();

    await releaseDeliverable(deliverable.id, admin.id);
    expect(await canAccessFile(asCustomer, file.id)).not.toBeNull();

    // Başka müşteri teslim videosuna erişemez
    const stranger = await createUser();
    expect(await canAccessFile({ ...asCustomer, id: stranger.id }, file.id)).toBeNull();

    // Teslimden sonra geri dönüş yok (revizyon hakkı bulunmuyor)
    await db.order.update({ where: { id: order.id }, data: { status: "READY_FOR_DELIVERY" } });
    await changeOrderStatus(order.id, "DELIVERED", admin.id);
    await expect(changeOrderStatus(order.id, "IN_PROGRESS", admin.id)).rejects.toThrow(/geçilemez/);
  });

  it("müşteri yalnızca kendi siparişine ekip mesajı gönderebilir; ekibe bildirim düşer", async () => {
    const { order, admin, customer } = await paidOrder(1);
    await sendCustomerMessage(customer.id, order.number, "Nakaratta kalın ve büyük font istiyorum.");
    const event = await db.orderEvent.findFirstOrThrow({ where: { orderId: order.id, type: "CUSTOMER_MESSAGE" } });
    expect(event.visibleToCustomer).toBe(true);
    expect(event.message).toBe("Nakaratta kalın ve büyük font istiyorum.");
    expect(await db.notification.count({ where: { userId: admin.id, type: "ADMIN_ALERT", orderId: order.id } })).toBeGreaterThan(0);

    const stranger = await createUser();
    await expect(sendCustomerMessage(stranger.id, order.number, "Merhaba")).rejects.toThrow(/bulunamadı/);
    await expect(sendCustomerMessage(customer.id, order.number, " ")).rejects.toThrow(/yaz/);
  });

  it("teslim edilmeden iptal edilen sipariş video haklarını iade eder", async () => {
    const { order, admin } = await paidOrder(3);
    const before = await db.packageEntitlement.findFirstOrThrow({ where: { sourceOrderId: order.id } });
    expect(before.usedVideos).toBe(3);
    await changeOrderStatus(order.id, "CANCELLED", admin.id, "Müşteri talebi");
    const after = await db.packageEntitlement.findFirstOrThrow({ where: { sourceOrderId: order.id } });
    expect(after.usedVideos).toBe(0);
  });

  it("eksik dosyalar tamamlanınca sipariş 'Yeni Sipariş' durumuna geçer", async () => {
    const customer = await createUser();
    const pkg = await createPackage();
    const order = await createPurchaseOrder(customer.id, pkg.slug, orderInput());
    const { paymentId } = await startPayment(order.number, customer.id, billing, "127.0.0.1");
    const payment = await db.payment.update({ where: { id: paymentId }, data: { mockOutcome: "success" } });
    await confirmByToken("MOCK", payment.providerToken!);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("AWAITING_FILES");

    const audio = await uploadedFile(customer.id, "SONG_AUDIO");
    await db.uploadedFile.update({ where: { id: audio.id }, data: { orderId: order.id } });
    await refreshFileRequirements(order.id);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("NEW");
  });
});
