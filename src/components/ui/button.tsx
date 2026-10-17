import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
export type ButtonSize = "sm" | "md" | "lg";

export function buttonClasses({
  variant = "primary",
  size = "md",
  block = false,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-[background-color,box-shadow,color,border-color,transform] duration-150",
    "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    size === "sm" && "h-9 px-3.5 text-sm",
    size === "md" && "h-11 px-5 text-[0.95rem]",
    size === "lg" && "h-13 px-7 text-base",
    // Birincil buton: logodaki "Lyrics" yeşili, üzerinde koyu metin (yüksek okunabilirlik)
    variant === "primary" &&
      "bg-lime text-ink shadow-[0_1px_2px_rgb(15_23_42/0.10),0_6px_16px_-8px_rgb(150_190_20/0.65)] ring-1 ring-inset ring-[#c4e534] hover:bg-lime-hover",
    variant === "secondary" && "border border-line bg-card text-ink shadow-[0_1px_2px_rgb(15_23_42/0.04)] hover:border-line-strong hover:bg-canvas",
    variant === "soft" && "bg-brand-soft text-brand-ink hover:bg-[#e7f99a]",
    variant === "ghost" && "text-ink-soft hover:bg-brand-tint hover:text-brand",
    variant === "danger" && "bg-danger text-white hover:bg-[#b91c1c]",
    block && "w-full",
    className,
  );
}

type Common = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; icon?: ReactNode };

export function Button({ variant, size, block, icon, className, children, ...props }: Common & ComponentProps<"button">) {
  return (
    <button className={buttonClasses({ variant, size, block, className })} {...props}>
      {icon}
      {children}
    </button>
  );
}

export function LinkButton({ variant, size, block, icon, className, children, ...props }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...props}>
      {icon}
      {children}
    </Link>
  );
}
