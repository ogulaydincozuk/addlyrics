"use client";

import { useActionState, useState } from "react";
import { MailCheck, MessageSquareText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { confirmPhoneCode, resendEmailVerification, sendPhoneCode } from "./actions";

function Status({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p className={cn("mt-3 text-sm", state.ok ? "text-success" : "text-danger")} role="status">
      {state.message}
    </p>
  );
}

export function EmailResend({ next }: { next: string }) {
  const [state, action, pending] = useActionState(resendEmailVerification.bind(null, next), initialActionState);
  return (
    <form action={action}>
      <Button type="submit" variant="secondary" size="sm" disabled={pending} icon={<MailCheck className="size-4" aria-hidden />}>
        {pending ? "Gönderiliyor…" : "Bağlantıyı tekrar gönder"}
      </Button>
      <Status state={state} />
    </form>
  );
}

export function PhoneVerification({ defaultPhone, smsAvailable }: { defaultPhone: string; smsAvailable: boolean }) {
  // Kod bir kez gönderildiyse, "yeni kod" isteği (ör. bekleme süresi) başarısız olsa da kod alanı açık kalır
  const [sendState, sendAction, sending] = useActionState(
    async (prev: ActionState & { sent?: boolean }, formData: FormData) => {
      const result = await sendPhoneCode(prev, formData);
      return { ...result, sent: Boolean(prev.sent || result.ok) };
    },
    initialActionState as ActionState & { sent?: boolean },
  );
  const [confirmState, confirmAction, confirming] = useActionState(confirmPhoneCode, initialActionState);
  const [phone, setPhone] = useState(defaultPhone);
  const codeSent = Boolean(sendState.sent);

  return (
    <div className="space-y-5">
      <form action={sendAction} className="space-y-3">
        <Field label="Cep telefonu" htmlFor="phone" hint="Türkiye dışı numaraları ülke koduyla yaz (+49…).">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05xx xxx xx xx"
              required
              disabled={!smsAvailable}
            />
            <Button type="submit" variant="secondary" disabled={sending || !smsAvailable} icon={<MessageSquareText className="size-4" aria-hidden />} className="shrink-0">
              {sending ? "Gönderiliyor…" : codeSent ? "Yeni kod gönder" : "Kod gönder"}
            </Button>
          </div>
        </Field>
        <Status state={sendState} />
      </form>

      {codeSent && (
        <form action={confirmAction} className="space-y-3 rounded-xl border border-line bg-canvas p-4">
          <Field label="Doğrulama kodu" htmlFor="code" hint="SMS ile gelen 6 haneli kodu yaz.">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{4,10}" maxLength={10} required className="sm:max-w-40" />
              <Button type="submit" disabled={confirming} icon={<ShieldCheck className="size-4" aria-hidden />}>
                {confirming ? "Doğrulanıyor…" : "Doğrula"}
              </Button>
            </div>
          </Field>
          <Status state={confirmState} />
        </form>
      )}
    </div>
  );
}
