// Sipariş durum makinesi — hangi durumdan hangisine geçilebileceğini tek yerde tanımlar.
import type { OrderStatusValue } from "./enums";

/** Admin/editör ekibinin panelden yapabileceği geçişler. */
const MANUAL_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  // Ödeme bekleyen sipariş elle "ödendi" yapılamaz: haklar yalnızca doğrulanmış ödemeyle tanımlanır.
  PAYMENT_PENDING: ["CANCELLED"],
  NEW: ["AWAITING_FILES", "ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  AWAITING_FILES: ["NEW", "ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "AWAITING_FILES", "NEW", "CANCELLED"],
  IN_PROGRESS: ["IN_REVIEW", "AWAITING_FILES", "CANCELLED"],
  IN_REVIEW: ["IN_PROGRESS", "READY_FOR_DELIVERY", "CANCELLED"],
  READY_FOR_DELIVERY: ["DELIVERED", "IN_REVIEW", "IN_PROGRESS"],
  // Revizyon hakkı yoktur: teslim edilen sipariş son durumdur
  DELIVERED: [],
  CANCELLED: [],
};

/** Sistemin otomatik yaptığı geçişler (ödeme onayı, dosyaların tamamlanması). */
const SYSTEM_TRANSITIONS: Partial<Record<OrderStatusValue, OrderStatusValue[]>> = {
  PAYMENT_PENDING: ["NEW", "AWAITING_FILES"],
  AWAITING_FILES: ["NEW"],
  // Ödeme, sipariş iptal edildikten sonra gelirse müşteri hakkını kaybetmez
  CANCELLED: ["NEW", "AWAITING_FILES"],
};

export type TransitionActor = "admin" | "system";

export function allowedTransitions(from: OrderStatusValue, actor: TransitionActor = "admin"): OrderStatusValue[] {
  return actor === "admin" ? MANUAL_TRANSITIONS[from] : (SYSTEM_TRANSITIONS[from] ?? []);
}

export function canTransition(from: OrderStatusValue, to: OrderStatusValue, actor: TransitionActor = "admin") {
  return allowedTransitions(from, actor).includes(to);
}

export const ACTIVE_STATUSES: OrderStatusValue[] = [
  "NEW",
  "AWAITING_FILES",
  "ASSIGNED",
  "IN_PROGRESS",
  "IN_REVIEW",
  "READY_FOR_DELIVERY",
];

/** Müşterinin dosya ekleyip silebildiği durumlar. */
export const CUSTOMER_EDITABLE_STATUSES: OrderStatusValue[] = ["PAYMENT_PENDING", "NEW", "AWAITING_FILES", "ASSIGNED"];

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger" | "progress";

export const STATUS_TONE: Record<OrderStatusValue, StatusTone> = {
  PAYMENT_PENDING: "warning",
  NEW: "info",
  AWAITING_FILES: "warning",
  ASSIGNED: "progress",
  IN_PROGRESS: "progress",
  IN_REVIEW: "progress",
  READY_FOR_DELIVERY: "success",
  DELIVERED: "success",
  CANCELLED: "neutral",
};

/** Müşteri panelindeki ilerleme çubuğu için adımlar. */
export const CUSTOMER_STEPS = [
  { key: "received", label: "Sipariş alındı" },
  { key: "assigned", label: "Editöre atandı" },
  { key: "production", label: "Hazırlanıyor" },
  { key: "review", label: "Kontrol ediliyor" },
  { key: "delivered", label: "Teslim edildi" },
] as const;

export function customerStepIndex(status: OrderStatusValue): number {
  switch (status) {
    case "PAYMENT_PENDING":
      return -1;
    case "NEW":
    case "AWAITING_FILES":
      return 0;
    case "ASSIGNED":
      return 1;
    case "IN_PROGRESS":
      return 2;
    case "IN_REVIEW":
    case "READY_FOR_DELIVERY":
      return 3;
    case "DELIVERED":
      return 4;
    case "CANCELLED":
      return -1;
  }
}
