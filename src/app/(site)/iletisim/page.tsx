import type { Metadata } from "next";
import { AtSign, Building2, Clock, Mail, MapPin, Phone } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { Card, Container } from "@/components/ui/primitives";
import { getSetting } from "@/server/queries/public";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "İletişim",
  description: "AddLyrics ekibiyle iletişime geç: paketler, siparişler ve iş birlikleri hakkında bize yaz.",
  alternates: { canonical: "/iletisim" },
};

export default async function ContactPage() {
  const c = await getSetting("contact");
  const items = [
    { icon: Mail, label: "E-posta", value: c.email, href: c.email ? `mailto:${c.email}` : null },
    { icon: Phone, label: "Telefon", value: c.phone, href: c.phone ? `tel:${c.phone.replace(/\s/g, "")}` : null },
    { icon: Phone, label: "WhatsApp", value: c.whatsapp, href: c.whatsapp ? `https://wa.me/${c.whatsapp.replace(/\D/g, "")}` : null },
    { icon: AtSign, label: "Instagram", value: c.instagram, href: c.instagram ? `https://instagram.com/${c.instagram.replace(/^@/, "")}` : null },
    { icon: Clock, label: "Çalışma saatleri", value: c.workingHours, href: null },
    { icon: MapPin, label: "Adres", value: c.address, href: null },
    { icon: Building2, label: "Şirket", value: [c.companyName, c.mersisNo && `MERSİS: ${c.mersisNo}`, c.taxInfo].filter(Boolean).join(" · "), href: null },
  ].filter((i) => i.value);

  return (
    <>
      <PageHeader eyebrow="İletişim" title="Bize Ulaş" description="Paketler, siparişin veya iş birlikleri hakkında sorularını yanıtlamaktan memnuniyet duyarız." />
      <Container className="grid gap-8 py-12 sm:py-16 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          {items.length ? (
            items.map((item) => (
              <Card key={item.label} className="flex items-start gap-4 p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
                  <item.icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{item.label}</p>
                  {item.href ? (
                    <a href={item.href} className="break-words font-semibold text-ink hover:text-brand" rel="noopener noreferrer">
                      {item.value}
                    </a>
                  ) : (
                    <p className="break-words font-semibold text-ink">{item.value}</p>
                  )}
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-6 text-sm text-muted">İletişim bilgilerimiz yakında burada olacak. Şimdilik formu kullanarak bize yazabilirsin.</Card>
          )}
        </div>
        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-ink">Mesaj gönder</h2>
          <p className="mt-1 text-sm text-muted">Genellikle iş günlerinde e-posta ile dönüş yaparız.</p>
          <div className="mt-6">
            <ContactForm />
          </div>
        </Card>
      </Container>
    </>
  );
}
