import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { messages } from "@/i18n/config";
import { safeNextPath } from "@/server/auth/guards";
import { getSessionUser } from "@/server/auth/session";
import { RegisterForm } from "../auth-forms";
import { AuthFormSkeleton, AuthShell } from "../auth-shell";
import { SelectedPackageAside } from "../selected-package";

export const metadata: Metadata = { title: "Hesap Oluştur", robots: { index: false } };

export default function RegisterPage({ searchParams }: PageProps<"/kayit">) {
  const t = messages().auth;
  return (
    <Suspense
      fallback={
        <AuthShell title={t.registerTitle} subtitle={t.registerSubtitle}>
          <AuthFormSkeleton />
        </AuthShell>
      }
    >
      <RegisterContent searchParams={searchParams} />
    </Suspense>
  );
}

async function RegisterContent({ searchParams }: Pick<PageProps<"/kayit">, "searchParams">) {
  const t = messages().auth;
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null, "");
  if (await getSessionUser()) redirect(next || "/panel");

  return (
    <AuthShell title={t.registerTitle} subtitle={t.registerSubtitle} aside={<SelectedPackageAside next={next} />}>
      <RegisterForm next={next} />
      <p className="mt-6 text-center text-sm text-muted">
        {t.haveAccount}{" "}
        <Link href={next ? `/giris?next=${encodeURIComponent(next)}` : "/giris"} className="font-semibold text-brand hover:underline">
          {t.loginTitle}
        </Link>
      </p>
    </AuthShell>
  );
}
