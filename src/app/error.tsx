"use client";

import Link from "next/link";
import { Button, LinkButton } from "@/components/ui/button";

// retry(): sayfa verisini yeniden çekerek dener (reset() yalnızca yeniden çizer, geçici sunucu hatalarında işe yaramaz)
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-ink">Bir şeyler ters gitti</h1>
      <p className="mt-2 max-w-md text-muted">
        İşlemin tamamlanamadı. Lütfen tekrar dene; sorun devam ederse{" "}
        <Link href="/iletisim" className="font-semibold text-brand hover:underline">
          bizimle iletişime geç
        </Link>
        .
      </p>
      {error.digest && <p className="mt-2 text-xs text-muted">Hata kodu: {error.digest}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>Tekrar dene</Button>
        <LinkButton href="/" variant="secondary">
          Ana sayfa
        </LinkButton>
        <LinkButton href="/iletisim" variant="ghost">
          İletişim
        </LinkButton>
      </div>
    </div>
  );
}
