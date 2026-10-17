"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/primitives";
import { initialActionState } from "@/lib/action-state";
import { changePassword, updateProfile } from "../actions";

export function ProfileForm({ defaults }: { defaults: { name: string; artistName: string; phone: string; email: string; phoneVerified?: boolean } }) {
  const [state, action, pending] = useActionState(updateProfile, initialActionState);
  const e = state.errors ?? {};
  // Hata durumunda React formu sıfırlar; alanlar gönderilen değerlerle yeniden doldurulur
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-5">
      {state.message && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      <Field
        label="E-posta"
        htmlFor="email"
        hint={
          <>
            E-posta adresini değiştirmek için{" "}
            <Link href="/iletisim" className="font-semibold text-brand hover:underline">
              bizimle iletişime geç
            </Link>
            .
          </>
        }
      >
        <Input id="email" value={defaults.email} disabled readOnly />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ad Soyad" htmlFor="name" error={e.name}>
          <Input id="name" name="name" defaultValue={v.name ?? defaults.name} autoComplete="name" aria-invalid={!!e.name} />
        </Field>
        <Field label="Sanatçı adı" htmlFor="artistName" optional error={e.artistName}>
          <Input id="artistName" name="artistName" defaultValue={v.artistName ?? defaults.artistName} />
        </Field>
      </div>
      <Field
        label="Telefon"
        htmlFor="phone"
        optional
        error={e.phone}
        hint={
          defaults.phoneVerified ? (
            <>
              Doğrulanmış telefon numarası değiştirilemez. Değişiklik için{" "}
              <Link href="/iletisim" className="font-semibold text-brand hover:underline">
                bizimle iletişime geç
              </Link>
              .
            </>
          ) : (
            <>
              Telefon numaran henüz doğrulanmadı.{" "}
              <Link href="/panel/dogrulama" className="font-semibold text-brand hover:underline">
                Doğrula →
              </Link>
            </>
          )
        }
      >
        <Input id="phone" name="phone" type="tel" defaultValue={v.phone ?? defaults.phone} autoComplete="tel" readOnly={defaults.phoneVerified} aria-invalid={!!e.phone} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Bilgilerimi Kaydet"}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initialActionState);
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-5">
      {state.message && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      <Field label="Mevcut şifre" htmlFor="currentPassword" error={e.currentPassword}>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" aria-invalid={!!e.currentPassword} />
      </Field>
      <Field label="Yeni şifre" htmlFor="newPassword" error={e.newPassword} hint="En az 8 karakter, en az bir harf ve bir rakam.">
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" aria-invalid={!!e.newPassword} />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Güncelleniyor…" : "Şifremi Değiştir"}
      </Button>
    </form>
  );
}
