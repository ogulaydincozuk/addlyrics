"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/primitives";
import { messages } from "@/i18n/config";
import { initialActionState } from "@/lib/action-state";
import { login, register, requestPasswordReset, resetPassword } from "./actions";

const t = messages().auth;

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, initialActionState);
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label={t.email} htmlFor="email" error={e.email}>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} required aria-invalid={!!e.email} />
      </Field>
      <Field label={t.password} htmlFor="password" error={e.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!e.password} />
      </Field>
      <div className="flex justify-end">
        <Link href="/sifremi-unuttum" className="text-sm font-semibold text-brand hover:underline">
          {t.forgot}
        </Link>
      </div>
      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? "Giriş yapılıyor…" : t.submitLogin}
      </Button>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(register, initialActionState);
  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label={t.name} htmlFor="name" error={e.name}>
        <Input id="name" name="name" autoComplete="name" defaultValue={v.name} required aria-invalid={!!e.name} />
      </Field>
      <Field label={t.artistName} htmlFor="artistName" optional error={e.artistName}>
        <Input id="artistName" name="artistName" defaultValue={v.artistName} />
      </Field>
      <Field label={t.email} htmlFor="email" error={e.email}>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} required aria-invalid={!!e.email} />
      </Field>
      <Field
        label="Cep telefonu"
        htmlFor="phone"
        error={e.phone}
        hint="Hesabını doğrulamak için SMS kodu göndereceğiz. Türkiye dışı numaraları ülke koduyla yaz (+49…)."
      >
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="05xx xxx xx xx" defaultValue={v.phone} required aria-invalid={!!e.phone} />
      </Field>
      <Field label={t.password} htmlFor="password" error={e.password} hint={t.passwordHint}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!e.password} />
      </Field>
      <div>
        <Checkbox
          name="kvkk"
          required
          defaultChecked={v.kvkk === "on"}
          label={
            <>
              <Link href="/kvkk-aydinlatma-metni" target="_blank" className="font-semibold text-brand hover:underline">
                KVKK Aydınlatma Metni
              </Link>
              &apos;ni okudum.
            </>
          }
        />
        {e.kvkk && <p className="mt-1.5 text-sm text-danger">{e.kvkk}</p>}
      </div>
      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? "Hesap oluşturuluyor…" : t.submitRegister}
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialActionState);
  if (state.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label={t.email} htmlFor="email" error={state.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email} required aria-invalid={!!state.errors?.email} />
      </Field>
      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? "Gönderiliyor…" : t.resetSubmit}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, initialActionState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.message && (
        <Alert tone="danger">
          {state.message}{" "}
          <Link href="/sifremi-unuttum" className="font-semibold underline">
            Yeni bağlantı iste
          </Link>
        </Alert>
      )}
      <Field label={t.newPassword} htmlFor="password" error={state.errors?.password} hint={t.passwordHint}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" block size="lg" disabled={pending}>
        {pending ? "Kaydediliyor…" : t.newPasswordSubmit}
      </Button>
    </form>
  );
}
