"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/primitives";
import { initialActionState, type ActionState } from "@/lib/action-state";

export function BillingForm({
  action: serverAction,
  defaults,
  amountLabel,
  providerLabel,
  disabled,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults: Record<string, string>;
  amountLabel: string;
  providerLabel: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(serverAction, initialActionState);
  const e = state.errors ?? {};
  const v = { ...defaults, ...(state.values ?? {}) };
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ad Soyad" htmlFor="billingName" error={e.billingName}>
          <Input id="billingName" name="billingName" autoComplete="name" defaultValue={v.billingName} aria-invalid={!!e.billingName} />
        </Field>
        <Field label="Telefon" htmlFor="billingPhone" error={e.billingPhone}>
          <Input id="billingPhone" name="billingPhone" type="tel" autoComplete="tel" placeholder="05xx xxx xx xx" defaultValue={v.billingPhone} aria-invalid={!!e.billingPhone} />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Şehir" htmlFor="billingCity" error={e.billingCity}>
          <Input id="billingCity" name="billingCity" autoComplete="address-level1" defaultValue={v.billingCity} aria-invalid={!!e.billingCity} />
        </Field>
        <Field
          label="T.C. kimlik no"
          htmlFor="billingIdentityNumber"
          optional
          error={e.billingIdentityNumber}
          hint="Fatura için gerekirse. Boş bırakabilirsin."
        >
          <Input id="billingIdentityNumber" name="billingIdentityNumber" inputMode="numeric" maxLength={11} defaultValue={v.billingIdentityNumber} aria-invalid={!!e.billingIdentityNumber} />
        </Field>
      </div>
      <Field label="Fatura adresi" htmlFor="billingAddress" error={e.billingAddress}>
        <Textarea id="billingAddress" name="billingAddress" rows={3} autoComplete="street-address" defaultValue={v.billingAddress} aria-invalid={!!e.billingAddress} />
      </Field>

      <div className="rounded-2xl border border-line bg-canvas p-4">
        <Checkbox
          name="distanceSales"
          defaultChecked={v.distanceSales === "on"}
          label={
            <>
              <Link href="/on-bilgilendirme-formu" target="_blank" className="font-semibold text-brand hover:underline">
                Ön Bilgilendirme Formu
              </Link>
              &apos;nu ve{" "}
              <Link href="/mesafeli-satis-sozlesmesi" target="_blank" className="font-semibold text-brand hover:underline">
                Mesafeli Satış Sözleşmesi
              </Link>
              &apos;ni okudum, onaylıyorum.
            </>
          }
        />
        {e.distanceSales && <p className="mt-2 text-sm text-danger">{e.distanceSales}</p>}
      </div>

      <Button type="submit" block size="lg" disabled={pending || disabled} icon={<Lock className="size-4" aria-hidden />}>
        {pending ? "Ödeme sayfası açılıyor…" : `${amountLabel} Öde`}
      </Button>
      <p className="text-center text-xs text-muted">
        Ödeme {providerLabel} güvenli ödeme sayfasında alınır. Kart bilgilerin AddLyrics tarafından görülmez ve saklanmaz.
      </p>
    </form>
  );
}
