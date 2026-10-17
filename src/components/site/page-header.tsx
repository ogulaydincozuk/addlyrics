import type { ReactNode } from "react";
import { Container } from "@/components/ui/primitives";

export function PageHeader({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden border-b border-line bg-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_90%_0%,#f1fcb8_0%,transparent_70%)]" />
      <Container className="relative py-12 sm:py-16">
        {eyebrow && <p className="mb-3 text-sm font-semibold text-brand">{eyebrow}</p>}
        <h1 className="max-w-3xl text-3xl font-extrabold text-ink sm:text-[2.6rem] sm:leading-tight">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{description}</p>}
        {children}
      </Container>
    </div>
  );
}
