"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";

/** Yönetim panelindeki sunucu eylemleri için ortak form: sonuç mesajı ve bekleme durumu gösterir. */
export function ActionForm({
  action: serverAction,
  children,
  submitLabel,
  pendingLabel = "Kaydediliyor…",
  variant = "primary",
  size = "sm",
  className,
  confirm,
  inline = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  className?: string;
  confirm?: string;
  inline?: boolean;
}) {
  const [state, action, pending] = useActionState(serverAction, initialActionState);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={cn(inline ? "flex flex-wrap items-end gap-2" : "space-y-3", className)}
    >
      {children}
      <div className={cn("flex flex-wrap items-center gap-3", inline && "contents")}>
        <Button type="submit" variant={variant} size={size} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {state.message && (
          <p className={cn("text-sm", state.ok ? "text-success" : "text-danger")} role="status">
            {state.message}
          </p>
        )}
      </div>
      {state.errors && (
        <ul className="text-sm text-danger">
          {Object.entries(state.errors).map(([k, v]) => (
            <li key={k}>{v}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
