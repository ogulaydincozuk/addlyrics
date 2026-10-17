import type { Metadata } from "next";
import Link from "next/link";
import { messages } from "@/i18n/config";
import { ForgotPasswordForm } from "../auth-forms";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Şifremi Unuttum", robots: { index: false } };

export default function ForgotPasswordPage() {
  const t = messages().auth;
  return (
    <AuthShell title={t.resetTitle} subtitle={t.resetSubtitle}>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/giris" className="font-semibold text-brand hover:underline">
          Giriş sayfasına dön
        </Link>
      </p>
    </AuthShell>
  );
}
