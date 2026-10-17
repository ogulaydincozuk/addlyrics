import type { ReactNode } from "react";
import { Card, Container } from "@/components/ui/primitives";

export function AuthShell({ title, subtitle, children, aside }: { title: string; subtitle: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto grid max-w-5xl items-start gap-8 lg:grid-cols-[1fr_0.85fr]">
        <Card className="p-6 sm:p-10">
          <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">{title}</h1>
          <p className="mt-2 text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </Card>
        {aside && <div className="lg:pt-6">{aside}</div>}
      </div>
    </Container>
  );
}

export function AuthFormSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <div className="mb-2 h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
        </div>
      ))}
      <div className="h-13 animate-pulse rounded-xl bg-brand-soft" />
    </div>
  );
}
