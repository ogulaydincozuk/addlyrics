import Link from "next/link";
import { cacheLife } from "next/cache";
import { Logo } from "@/components/brand/logo";
import { messages } from "@/i18n/config";
import { getSetting } from "@/server/queries/public";

async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export async function SiteFooter() {
  const t = messages();
  const contact = await getSetting("contact");
  const columns = [
    {
      title: "AddLyrics",
      links: [
        { href: "/hakkimizda", label: t.footer.about },
        { href: "/iletisim", label: t.footer.contact },
      ],
    },
    {
      title: "Hizmet",
      links: [
        { href: "/paketler", label: t.footer.packages },
        { href: "/ornekler", label: t.nav.examples },
        { href: "/#nasil-calisir", label: t.nav.howItWorks },
        { href: "/sss", label: t.footer.faq },
      ],
    },
    {
      title: "Yasal",
      links: [
        { href: "/gizlilik-politikasi", label: t.footer.privacy },
        { href: "/kullanim-kosullari", label: t.footer.terms },
        { href: "/iptal-ve-iade-politikasi", label: t.footer.refund },
        { href: "/kvkk-aydinlatma-metni", label: t.footer.kvkk },
        { href: "/mesafeli-satis-sozlesmesi", label: t.footer.distanceSales },
        { href: "/on-bilgilendirme-formu", label: t.footer.preInfo },
      ],
    },
  ];

  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">{t.brand.slogan}</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">{t.footer.humanMade}</p>
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
              {contact.email}
            </a>
          )}
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-bold text-ink">{col.title}</p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted transition-colors hover:text-brand">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © <CurrentYear /> {contact.companyName || "AddLyrics"}. {t.footer.rights}
          </p>
          <p>Kart bilgileriniz AddLyrics tarafından görülmez ve saklanmaz.</p>
        </div>
      </div>
    </footer>
  );
}
