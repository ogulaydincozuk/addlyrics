import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 text-center">
      <Link href="/" aria-label="Ana sayfa">
        <Logo />
      </Link>
      <p className="mt-10 font-display text-6xl font-extrabold text-ink">404</p>
      <h1 className="mt-3 text-xl font-bold text-ink">Aradığın sayfa bulunamadı</h1>
      <p className="mt-2 max-w-md text-muted">Bağlantı değişmiş veya sayfa kaldırılmış olabilir.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <LinkButton href="/">Ana Sayfa</LinkButton>
        <LinkButton href="/paketler" variant="secondary">
          Paketleri İncele
        </LinkButton>
      </div>
    </div>
  );
}
