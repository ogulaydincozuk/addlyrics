import { Badge } from "@/components/ui/primitives";
import { messages } from "@/i18n/config";
import type { OrderStatusValue } from "@/lib/enums";
import { STATUS_TONE } from "@/lib/order-status";

export function OrderStatusBadge({ status }: { status: OrderStatusValue }) {
  return <Badge tone={STATUS_TONE[status]}>{messages().enums.orderStatus[status]}</Badge>;
}

const PAYMENT_TONE = {
  PENDING: "warning",
  SUCCEEDED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
} as const;

export function PaymentStatusBadge({ status }: { status: keyof typeof PAYMENT_TONE }) {
  return <Badge tone={PAYMENT_TONE[status]}>{messages().enums.paymentStatus[status]}</Badge>;
}

