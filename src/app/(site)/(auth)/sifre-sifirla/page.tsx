import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/primitives";
import { messages } from "@/i18n/config";
import { ResetPasswordForm } from "../auth-forms";
import { AuthFormSkeleton, AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Yeni Şifre Belirle", robots: { index: false } };

export default function ResetPasswordPage({ searchParams }: PageProps<"/sifre-sifirla">) {
  const t = messages().auth;
  return (
    <AuthShell title={t.newPasswordTitle} subtitle="Hesabın için yeni bir şifre belirle.">
      <Suspense fallback={<AuthFormSkeleton />}>
        <ResetContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function ResetContent({ searchParams }: Pick<PageProps<"/sifre-sifirla">, "searchParams">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  if (!token) {
    return (
      <Alert tone="danger">
        {messages().auth.resetInvalid}{" "}
        <Link href="/sifremi-unuttum" className="font-semibold underline">
          Yeni bağlantı iste
        </Link>
      </Alert>
    );
  }
  return <ResetPasswordForm token={token} />;
}
