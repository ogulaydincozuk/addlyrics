import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { messages } from "@/i18n/config";
import { safeNextPath } from "@/server/auth/guards";
import { getSessionUser } from "@/server/auth/session";
import { LoginForm } from "../auth-forms";
import { AuthFormSkeleton, AuthShell } from "../auth-shell";
import { SelectedPackageAside } from "../selected-package";

export const metadata: Metadata = { title: "Giriş Yap", robots: { index: false } };

export default function LoginPage({ searchParams }: PageProps<"/giris">) {
  const t = messages().auth;
  return (
    <Suspense
      fallback={
        <AuthShell title={t.loginTitle} subtitle={t.loginSubtitle}>
          <AuthFormSkeleton />
        </AuthShell>
      }
    >
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/giris">, "searchParams">) {
  const t = messages().auth;
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null, "");
  if (await getSessionUser()) redirect(next || "/panel");

  return (
    <AuthShell title={t.loginTitle} subtitle={t.loginSubtitle} aside={<SelectedPackageAside next={next} />}>
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-muted">
        {t.noAccount}{" "}
        <Link href={next ? `/kayit?next=${encodeURIComponent(next)}` : "/kayit"} className="font-semibold text-brand hover:underline">
          {t.registerTitle}
        </Link>
      </p>
    </AuthShell>
  );
}
