import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { OrderStatusValue } from "@/lib/enums";
import { CUSTOMER_STEPS, customerStepIndex } from "@/lib/order-status";

/** Müşteri için sade ilerleme çizelgesi. */
export function OrderProgress({ status, compact = false }: { status: OrderStatusValue; compact?: boolean }) {
  const current = customerStepIndex(status);
  if (current < 0) return null;
  return (
    <ol className={cn("grid grid-cols-5 gap-1.5", compact ? "" : "sm:gap-3")} aria-label="Sipariş ilerlemesi">
      {CUSTOMER_STEPS.map((step, i) => {
        const done = i < current || (i === current && status === "DELIVERED");
        const active = i === current && status !== "DELIVERED";
        return (
          <li key={step.key} className="min-w-0">
            <div className={cn("h-1.5 rounded-full", done ? "bg-success" : active ? "bg-brand" : "bg-line")} />
            {!compact && (
              <p className={cn("mt-2 flex items-center gap-1 truncate text-xs font-medium", done ? "text-success" : active ? "text-brand" : "text-muted")}>
                {done && <Check className="size-3 shrink-0" aria-hidden />}
                <span className="truncate">{step.label}</span>
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
