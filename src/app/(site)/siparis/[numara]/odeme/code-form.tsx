"use client";

import { useActionState } from "react";
import { TicketPercent, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { applyCodeAction } from "./actions";

export function ReferralCodeForm({
  orderNumber,
  appliedCode,
  discountLabel,
  remove,
}: {
  orderNumber: string;
  appliedCode: string | null;
  discountLabel: string | null;
  remove: () => Promise<void>;
}) {
  const [state, action, pending] = useActionState(applyCodeAction.bind(null, orderNumber), initialActionState);

  if (appliedCode) {
    return (
      <form action={remove} className="flex items-center justify-between gap-3 rounded-xl bg-success-soft px-3 py-2 text-sm text-[#166534]">
        <span className="flex items-center gap-2 font-semibold">
          <TicketPercent className="size-4" aria-hidden /> {appliedCode} uygulandı{discountLabel ? `: −${discountLabel}` : ""}
        </span>
        <button type="submit" className="inline-flex items-center gap-1 text-xs font-semibold hover:underline">
          <X className="size-3.5" aria-hidden /> Kaldır
        </button>
      </form>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="code" className="flex items-center gap-2 text-sm font-semibold text-ink">
        <TicketPercent className="size-4 text-brand" aria-hidden /> Referans veya indirim kodun var mı?
      </label>
      <p className="text-xs text-muted">İş ortaklarımızdan veya bir kampanyadan aldığın kodu yaz; indirim toplam tutara hemen yansır.</p>
      <div className="flex gap-2">
        <Input id="code" name="code" autoComplete="off" autoCapitalize="characters" maxLength={30} placeholder="KOD" className="uppercase" />
        <Button type="submit" variant="secondary" size="sm" disabled={pending} className="shrink-0">
          {pending ? "…" : "Uygula"}
        </Button>
      </div>
      {state.message && (
        <p className={cn("text-xs", state.ok ? "text-success" : "text-danger")} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
