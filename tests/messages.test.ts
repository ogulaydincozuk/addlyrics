import { beforeEach, describe, expect, it } from "vitest";
import { messageThreadState } from "@/lib/order-messages";
import { db } from "@/server/db";
import { createPurchaseOrder, markMessagesHandled, sendCustomerMessage, sendCustomerNote } from "@/server/domain/orders";
import { countAwaitingMessages, getOrderMessageThreads } from "@/server/queries/messages";
import { createPackage, createUser, orderInput, resetDb } from "./helpers";

async function orderFor(userId: string) {
  const pkg = await createPackage();
  return createPurchaseOrder(userId, pkg.slug, orderInput({ fileIds: [] }));
}

describe("sipariş mesajları (yönetim gelen kutusu)", () => {
  beforeEach(resetDb);

  it("konuşma durumu son mesajlaşma olayına göre belirlenir", () => {
    expect(messageThreadState("CUSTOMER_MESSAGE")).toBe("AWAITING_REPLY");
    expect(messageThreadState("NOTE")).toBe("REPLIED");
    expect(messageThreadState("MESSAGE_HANDLED")).toBe("HANDLED");
    expect(messageThreadState("STATUS_CHANGE")).toBeNull();
    expect(messageThreadState(undefined)).toBeNull();
  });

  it("müşteri mesajı yöneticiye düşer; ekip yanıtı veya 'yanıt gerekmiyor' konuşmayı kapatır", async () => {
    const admin = await createUser("ADMIN");
    const customer = await createUser();
    const order = await orderFor(customer.id);
    expect(await countAwaitingMessages()).toMatchObject({ orders: 0 });
    expect(await getOrderMessageThreads()).toEqual([]);

    await sendCustomerMessage(customer.id, order.number, "Merhaba, renkler koyu olsun");
    expect((await countAwaitingMessages()).orders).toBe(1);
    let [thread] = await getOrderMessageThreads();
    expect(thread).toMatchObject({ number: order.number, state: "AWAITING_REPLY", messageCount: 1, last: { from: "customer", text: "Merhaba, renkler koyu olsun" } });
    expect(await db.notification.count({ where: { userId: admin.id, orderId: order.id, type: "ADMIN_ALERT" } })).toBe(1);

    await sendCustomerNote(order.id, "Tamam, koyu tonlarla hazırlıyoruz.", admin.id);
    expect((await countAwaitingMessages()).orders).toBe(0);
    [thread] = await getOrderMessageThreads();
    expect(thread).toMatchObject({ state: "REPLIED", messageCount: 2, last: { from: "team" } });

    await sendCustomerMessage(customer.id, order.number, "Teşekkürler!");
    expect((await countAwaitingMessages()).orders).toBe(1);
    await markMessagesHandled(order.id, admin.id);
    expect((await countAwaitingMessages()).orders).toBe(0);
    [thread] = await getOrderMessageThreads();
    expect(thread!.state).toBe("HANDLED");
    // "Yanıt gerekmiyor" işareti iç kayıttır, müşteri görmez
    expect(await db.orderEvent.count({ where: { orderId: order.id, type: "MESSAGE_HANDLED", visibleToCustomer: true } })).toBe(0);
  });

  it("yanıt bekleyen konuşmalar daha yeni hareket eden yanıtlanmışların önünde listelenir", async () => {
    const admin = await createUser("ADMIN");
    const a = await createUser();
    const b = await createUser();
    const waiting = await orderFor(a.id);
    const replied = await orderFor(b.id);
    await sendCustomerMessage(a.id, waiting.number, "Ne zaman başlıyorsunuz?");
    await sendCustomerMessage(b.id, replied.number, "Sözler ekte");
    await sendCustomerNote(replied.id, "Aldık, teşekkürler.", admin.id);

    const threads = await getOrderMessageThreads();
    expect(threads.map((t) => [t.number, t.state])).toEqual([
      [waiting.number, "AWAITING_REPLY"],
      [replied.number, "REPLIED"],
    ]);
    expect(await countAwaitingMessages()).toMatchObject({ orders: 1, total: 1 });
  });
});
