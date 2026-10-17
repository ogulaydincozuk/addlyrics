import "server-only";
import type { OrderStatus } from "@prisma/client";
import { messageThreadState, VISIBLE_MESSAGE_TYPES, type MessageThreadState } from "@/lib/order-messages";
import { db } from "../db";

/**
 * Yönetim menüsü ve gösterge paneli için: son sözü müşteride olan sipariş konuşmaları ve
 * işlenmemiş iletişim formu mesajları.
 */
export async function countAwaitingMessages() {
  const [rows, contact] = await Promise.all([
    db.$queryRaw<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n FROM (
        SELECT DISTINCT ON ("orderId") "type" FROM "OrderEvent"
        WHERE "type" IN ('CUSTOMER_MESSAGE', 'NOTE', 'MESSAGE_HANDLED')
        ORDER BY "orderId", "createdAt" DESC
      ) t
      WHERE t."type" = 'CUSTOMER_MESSAGE'`,
    db.contactMessage.count({ where: { handledAt: null } }),
  ]);
  const orders = rows[0]?.n ?? 0;
  return { orders, contact, total: orders + contact };
}

export type OrderMessageThread = {
  orderId: string;
  number: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  song: string;
  state: MessageThreadState;
  lastActivityAt: Date;
  last: { from: "customer" | "team"; text: string; at: Date } | null;
  messageCount: number;
};

/** Mesajlaşması olan siparişler: yanıt bekleyenler önce, sonra en son hareket edenler. */
export async function getOrderMessageThreads(limit = 100): Promise<OrderMessageThread[]> {
  const latest = await db.$queryRaw<Array<{ orderId: string; type: string; createdAt: Date }>>`
    SELECT * FROM (
      SELECT DISTINCT ON ("orderId") "orderId", "type", "createdAt" FROM "OrderEvent"
      WHERE "type" IN ('CUSTOMER_MESSAGE', 'NOTE', 'MESSAGE_HANDLED')
      ORDER BY "orderId", "createdAt" DESC
    ) t
    ORDER BY (t."type" = 'CUSTOMER_MESSAGE') DESC, t."createdAt" DESC
    LIMIT ${limit}`;
  if (!latest.length) return [];
  const ids = latest.map((l) => l.orderId);
  const [orders, events] = await Promise.all([
    db.order.findMany({
      where: { id: { in: ids } },
      select: { id: true, number: true, status: true, user: { select: { name: true, email: true } }, song: { select: { artistName: true, title: true } } },
    }),
    db.orderEvent.findMany({
      where: { orderId: { in: ids }, type: { in: [...VISIBLE_MESSAGE_TYPES] } },
      orderBy: { createdAt: "desc" },
      select: { orderId: true, type: true, message: true, createdAt: true },
    }),
  ]);
  const byId = new Map(orders.map((o) => [o.id, o]));
  return latest.flatMap((l) => {
    const order = byId.get(l.orderId);
    const state = messageThreadState(l.type);
    if (!order || !state) return [];
    const messages = events.filter((e) => e.orderId === l.orderId);
    const last = messages[0];
    return [
      {
        orderId: order.id,
        number: order.number,
        status: order.status,
        customerName: order.user.name,
        customerEmail: order.user.email,
        song: `${order.song.artistName} – ${order.song.title}`,
        state,
        lastActivityAt: l.createdAt,
        last: last ? { from: last.type === "CUSTOMER_MESSAGE" ? "customer" : "team", text: last.message ?? "", at: last.createdAt } : null,
        messageCount: messages.length,
      },
    ];
  });
}
