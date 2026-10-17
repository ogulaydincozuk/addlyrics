"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/primitives";
import { initialActionState } from "@/lib/action-state";
import { changePassword, updateProfile } from "../actions";

export function ProfileForm({ defaults }: { defaults: { name: string; artistName: string; phone: string; email: string; phoneVerified?: boolean } }) {
  const [state, action, pending] = useActionState(updateProfile, initialActionState);
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-5">
      {state.message && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      <Field label="E-posta" htmlFor="email" hint="E-posta adresini değiştirmek için bizimle iletişime geç.">
        <Input id="email" value={defaults.email} disabled readOnly />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ad Soyad" htmlFor="name" error={e.name}>
          <Input id="name" name="name" defaultValue={defaults.name} autoComplete="name" aria-invalid={!!e.name} />
        </Field>
        <Field label="Sanatçı adı" htmlFor="artistName" optional error={e.artistName}>
          <Input id="artistName" name="artistName" defaultValue={defaults.artistName} />
        </Field>
      </div>
      <Field
        label="Telefon"
        htmlFor="phone"
        optional
        error={e.phone}
        hint={defaults.phoneVerified ? "Doğrulanmış telefon numarası değiştirilemez. Değişiklik için bizimle iletişime geç." : undefined}
      >
        <Input id="phone" name="phone" type="tel" defaultValue={defaults.phone} autoComplete="tel" readOnly={defaults.phoneVerified} aria-invalid={!!e.phone} />
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
