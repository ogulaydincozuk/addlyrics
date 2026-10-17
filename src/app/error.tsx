"use client";

import { Button, LinkButton } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-ink">Bir şeyler ters gitti</h1>
      <p className="mt-2 max-w-md text-muted">İşlemin tamamlanamadı. Lütfen tekrar dene; sorun devam ederse bizimle iletişime geç.</p>
      {error.digest && <p className="mt-2 text-xs text-muted">Hata kodu: {error.digest}</p>}
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Tekrar dene</Button>
        <LinkButton href="/" variant="secondary">
          Ana sayfa
        </LinkButton>
      </div>
    </div>
  );
}
