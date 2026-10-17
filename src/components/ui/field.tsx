import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const controlBase =
  "w-full rounded-xl border border-line bg-card px-3.5 text-[0.95rem] text-ink placeholder:text-slate-400 shadow-[0_1px_2px_rgb(15_23_42/0.03)] transition-[border-color,box-shadow] focus:border-brand focus:outline-none focus:shadow-[var(--shadow-focus)] disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted aria-[invalid=true]:border-danger";

export function Label({ className, children, optional, ...props }: ComponentProps<"label"> & { optional?: boolean }) {
  return (
    <label className={cn("mb-1.5 block text-sm font-semibold text-ink", className)} {...props}>
      {children}
      {optional && <span className="ml-1.5 text-xs font-normal text-muted">(isteğe bağlı)</span>}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlBase, "min-h-28 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        controlBase,
        "h-11 appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2364748B' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:16px] bg-[right_0.85rem_center] bg-no-repeat pr-10",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function FieldError({ children, id }: { children?: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-danger" role="alert">
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-sm text-muted">{children}</p>;
}

export function Field({
  label,
  htmlFor,
  optional,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  optional?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} optional={optional}>
        {label}
      </Label>
      {children}
      {error ? <FieldError id={htmlFor ? `${htmlFor}-error` : undefined}>{error}</FieldError> : hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink-soft", className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-md border-line-strong accent-brand"
        {...props}
      />
      <span>
        <span className="text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-muted">{description}</span>}
      </span>
    </label>
  );
}
