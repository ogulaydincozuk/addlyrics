"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/primitives";
import { initialActionState } from "@/lib/action-state";
import { sendContactMessage } from "./actions";

export function ContactForm() {
  const [state, action, pending] = useActionState(sendContactMessage, initialActionState);
  const subjectRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const konu = new URLSearchParams(window.location.search).get("konu");
    if (konu === "paket" && subjectRef.current && !subjectRef.current.value) {
      subjectRef.current.value = "Paketler hakkında bilgi";
    }
  }, []);

  if (state.ok) {
    return <Alert tone="success" title="Teşekkürler!">{state.message}</Alert>;
  }

  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Adın" htmlFor="name" error={e.name}>
          <Input id="name" name="name" defaultValue={v.name} autoComplete="name" required aria-invalid={!!e.name} />
        </Field>
        <Field label="E-posta" htmlFor="email" error={e.email}>
          <Input id="email" name="email" type="email" defaultValue={v.email} autoComplete="email" required aria-invalid={!!e.email} />
        </Field>
      </div>
      <Field label="Konu" htmlFor="subject" optional error={e.subject}>
        <Input id="subject" name="subject" ref={subjectRef} defaultValue={v.subject} />
      </Field>
      <Field label="Mesajın" htmlFor="message" error={e.message}>
        <Textarea id="message" name="message" rows={6} defaultValue={v.message} required aria-invalid={!!e.message} />
      </Field>
      {/* Bot tuzağı — gerçek kullanıcılar görmez */}
      <div className="hidden" aria-hidden>
        <label htmlFor="website">Web sitesi</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <p className="text-xs text-muted">
        Gönderdiğin bilgiler yalnızca mesajına dönüş yapmak için kullanılır. Ayrıntılar KVKK Aydınlatma Metni&apos;nde.
      </p>
      <Button type="submit" disabled={pending} icon={<Send className="size-4" aria-hidden />}>
        {pending ? "Gönderiliyor…" : "Mesajı Gönder"}
      </Button>
    </form>
  );
}
