import type { Metadata } from "next";
import { Field, Input, Textarea } from "@/components/ui/field";
import type { SettingValue } from "@/content/settings";
import { requireAdmin } from "@/server/auth/guards";
import { getSetting } from "@/server/queries/public";
import { ActionForm } from "../_forms";
import { AdminPage, Section } from "../_ui";
import { resetSettingAction, saveSettingAction } from "./actions";

export const metadata: Metadata = { title: "Site İçerikleri" };

export default function ContentAdminPage() {
  return (
    <AdminPage title="Site İçerikleri" description="Ana sayfa metinleri, iletişim ve şirket bilgileri ile SEO ayarları. Kod değişikliği gerekmez.">
      <Content />
    </AdminPage>
  );
}

const STYLE_LABELS = { FILM_EDIT: "Film Edit", MINIMAL: "Minimal", MUSIC_VIDEO: "Music Video" } as const;

async function Content() {
  await requireAdmin();
  const [home, contact, seo] = await Promise.all([getSetting("home"), getSetting("contact"), getSetting("seo")]);
  return (
    <div className="space-y-6">
      <Section title="İletişim ve şirket bilgileri" description="İletişim sayfası ve alt bilgide görünür. Mesafeli satış için şirket unvanı, adres, telefon, e-posta ve MERSİS no zorunludur.">
        <ActionForm action={saveSettingAction.bind(null, "contact")} submitLabel="Kaydet">
          <ContactFields contact={contact} />
        </ActionForm>
      </Section>

      <Section title="Ana sayfa metinleri">
        <ActionForm action={saveSettingAction.bind(null, "home")} submitLabel="Ana sayfayı kaydet">
          <HomeFields home={home} />
        </ActionForm>
        <div className="mt-4 border-t border-line pt-4">
          <ActionForm action={resetSettingAction.bind(null, "home")} submitLabel="Varsayılan metinlere dön" variant="ghost" confirm="Ana sayfa metinleri varsayılana dönecek. Emin misin?" />
        </div>
      </Section>

      <Section title="SEO" description="Ana sayfa başlığı ve açıklaması (arama sonuçlarında görünür).">
        <ActionForm action={saveSettingAction.bind(null, "seo")} submitLabel="Kaydet">
          <Field label="Site başlığı" htmlFor="siteTitle">
            <Input id="siteTitle" name="siteTitle" defaultValue={seo.siteTitle} maxLength={120} />
          </Field>
          <Field label="Site açıklaması" htmlFor="siteDescription">
            <Textarea id="siteDescription" name="siteDescription" rows={3} defaultValue={seo.siteDescription} maxLength={300} />
          </Field>
        </ActionForm>
      </Section>
    </div>
  );
}

function ContactFields({ contact }: { contact: SettingValue<"contact"> }) {
  const fields: Array<[keyof SettingValue<"contact">, string]> = [
    ["companyName", "Şirket unvanı"],
    ["email", "E-posta"],
    ["phone", "Telefon"],
    ["whatsapp", "WhatsApp"],
    ["mersisNo", "MERSİS no"],
    ["taxInfo", "Vergi dairesi / no"],
    ["kepAddress", "KEP adresi"],
    ["instagram", "Instagram kullanıcı adı"],
    ["workingHours", "Çalışma saatleri"],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map(([k, label]) => (
        <Field key={k} label={label} htmlFor={`c-${k}`} optional>
          <Input id={`c-${k}`} name={k} defaultValue={contact[k]} />
        </Field>
      ))}
      <Field label="Adres" htmlFor="c-address" optional className="md:col-span-2">
        <Textarea id="c-address" name="address" rows={2} defaultValue={contact.address} />
      </Field>
    </div>
  );
}

function HomeFields({ home }: { home: SettingValue<"home"> }) {
  return (
    <div className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="text-sm font-bold text-ink">Hero</legend>
        <Field label="Ana başlık" htmlFor="heroTitle">
          <Input id="heroTitle" name="heroTitle" defaultValue={home.heroTitle} />
        </Field>
        <Field label="Açıklama" htmlFor="heroDescription">
          <Textarea id="heroDescription" name="heroDescription" rows={3} defaultValue={home.heroDescription} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Birincil buton" htmlFor="heroPrimaryCta">
            <Input id="heroPrimaryCta" name="heroPrimaryCta" defaultValue={home.heroPrimaryCta} />
          </Field>
          <Field label="İkincil buton" htmlFor="heroSecondaryCta">
            <Input id="heroSecondaryCta" name="heroSecondaryCta" defaultValue={home.heroSecondaryCta} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {home.trustPoints.map((p, i) => (
            <Field key={i} label={`Güven maddesi ${i + 1}`} htmlFor={`tp-${i}`}>
              <Input id={`tp-${i}`} name={`trustPoints.${i}`} defaultValue={p} />
            </Field>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-bold text-ink">Video tarzları</legend>
        <Field label="Bölüm başlığı" htmlFor="stylesTitle">
          <Input id="stylesTitle" name="stylesTitle" defaultValue={home.stylesTitle} />
        </Field>
        {(["FILM_EDIT", "MINIMAL", "MUSIC_VIDEO"] as const).map((s) => (
          <div key={s} className="grid gap-4 md:grid-cols-[220px_1fr]">
            <Field label={`${STYLE_LABELS[s]} başlığı`} htmlFor={`st-${s}`}>
              <Input id={`st-${s}`} name={`styles.${s}.title`} defaultValue={home.styles[s].title} />
            </Field>
            <Field label="Açıklama" htmlFor={`sd-${s}`}>
              <Textarea id={`sd-${s}`} name={`styles.${s}.description`} rows={2} defaultValue={home.styles[s].description} />
            </Field>
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-bold text-ink">Nasıl çalışır?</legend>
        <Field label="Bölüm başlığı" htmlFor="stepsTitle">
          <Input id="stepsTitle" name="stepsTitle" defaultValue={home.stepsTitle} />
        </Field>
        {home.steps.map((step, i) => (
          <div key={i} className="grid gap-4 md:grid-cols-[220px_1fr]">
            <Field label={`Adım ${i + 1}`} htmlFor={`stt-${i}`}>
              <Input id={`stt-${i}`} name={`steps.${i}.title`} defaultValue={step.title} />
            </Field>
            <Field label="Açıklama" htmlFor={`std-${i}`}>
              <Input id={`std-${i}`} name={`steps.${i}.description`} defaultValue={step.description} />
            </Field>
          </div>
        ))}
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-2">
        <legend className="mb-2 text-sm font-bold text-ink">Paketler ve örnekler</legend>
        <Field label="Paketler başlığı" htmlFor="packagesTitle">
          <Input id="packagesTitle" name="packagesTitle" defaultValue={home.packagesTitle} />
        </Field>
        <Field label="Paketler açıklaması" htmlFor="packagesDescription">
          <Input id="packagesDescription" name="packagesDescription" defaultValue={home.packagesDescription} />
        </Field>
        <Field label="Portfolyo başlığı" htmlFor="portfolioTitle">
          <Input id="portfolioTitle" name="portfolioTitle" defaultValue={home.portfolioTitle} />
        </Field>
        <Field label="Portfolyo açıklaması" htmlFor="portfolioDescription">
          <Input id="portfolioDescription" name="portfolioDescription" defaultValue={home.portfolioDescription} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-bold text-ink">Neden AddLyrics? · SSS · Son çağrı</legend>
        <Field label="Neden AddLyrics başlığı" htmlFor="whyTitle">
          <Input id="whyTitle" name="whyTitle" defaultValue={home.whyTitle} />
        </Field>
        <Field label="Avantajlar" htmlFor="whyPoints" hint="Her satır bir madde.">
          <Textarea id="whyPoints" name="whyPoints" rows={5} defaultValue={home.whyPoints.join("\n")} />
        </Field>
        <Field label="SSS başlığı" htmlFor="faqTitle">
          <Input id="faqTitle" name="faqTitle" defaultValue={home.faqTitle} />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Son çağrı başlığı" htmlFor="finalTitle">
            <Input id="finalTitle" name="finalTitle" defaultValue={home.finalTitle} />
          </Field>
          <Field label="Son çağrı açıklaması" htmlFor="finalDescription">
            <Input id="finalDescription" name="finalDescription" defaultValue={home.finalDescription} />
          </Field>
          <Field label="Son çağrı butonu" htmlFor="finalCta">
            <Input id="finalCta" name="finalCta" defaultValue={home.finalCta} />
          </Field>
        </div>
      </fieldset>
    </div>
  );
}
