import type { Package } from "@prisma/client";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { messages } from "@/i18n/config";
import { allocationLabel } from "@/lib/delivery-plan";
import { VIDEO_FORMATS, VIDEO_STYLES } from "@/lib/enums";
import { ActionForm } from "../_forms";
import { savePackageAction } from "./actions";

function kurusToInput(kurus: number | null) {
  if (kurus == null) return "";
  const whole = Math.floor(kurus / 100);
  const frac = kurus % 100;
  return frac ? `${whole},${String(frac).padStart(2, "0")}` : String(whole);
}

/** Paket oluşturma/düzenleme formu (sunucu bileşeni; gönderim istemci ActionForm ile). */
export function PackageForm({ pkg }: { pkg: Package | null }) {
  const t = messages();
  return (
    <ActionForm action={savePackageAction.bind(null, pkg?.id ?? null)} submitLabel={pkg ? "Değişiklikleri kaydet" : "Paketi oluştur"} size="md">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Paket adı" htmlFor="name">
          <Input id="name" name="name" defaultValue={pkg?.name ?? ""} required />
        </Field>
        <Field label="Adres (slug)" htmlFor="slug" hint="Boş bırakılırsa addan üretilir. Örn: 3-aylik-paket">
          <Input id="slug" name="slug" defaultValue={pkg?.slug ?? ""} />
        </Field>
        <Field label="Kısa açıklama" htmlFor="tagline" optional className="md:col-span-2">
          <Input id="tagline" name="tagline" defaultValue={pkg?.tagline ?? ""} />
        </Field>
        <Field label="Süre (ay)" htmlFor="durationMonths">
          <Input id="durationMonths" name="durationMonths" type="number" min={1} max={36} defaultValue={pkg?.durationMonths ?? 1} required />
        </Field>
        <Field label="Fiyat (TL)" htmlFor="price" hint="Örn. 4.990 veya 4990,50. Boş = fiyat belirlenmedi (satın alınamaz).">
          <Input id="price" name="price" inputMode="decimal" defaultValue={kurusToInput(pkg?.priceKurus ?? null)} />
        </Field>
        <Field label="Pakete dahil video sayısı" htmlFor="videoCount">
          <Input id="videoCount" name="videoCount" type="number" min={1} defaultValue={pkg?.videoCount ?? ""} />
        </Field>
        <Field label="Bonus video" htmlFor="bonusVideoCount" hint="Teslim edilecek toplam = video sayısı + bonus.">
          <Input id="bonusVideoCount" name="bonusVideoCount" type="number" min={0} defaultValue={pkg?.bonusVideoCount ?? 0} />
        </Field>
        <div className="rounded-xl bg-canvas p-3 text-sm text-muted ring-1 ring-line">
          <p className="font-semibold text-ink">Teslim planı (otomatik)</p>
          Video sayısı süreye eşit bölünür, bonus videolar son teslime eklenir. Ayın 1–15&apos;i arasındaki alımlarda ilk teslim 5 iş günü içinde, 16&apos;sından sonra izleyen ayın 1&apos;inde; sonraki teslimler her ayın 1&apos;inde.
          {pkg?.videoCount ? (
            <span className="mt-1 block font-medium text-ink">
              Bu paket: {allocationLabel(pkg.videoCount, pkg.bonusVideoCount, pkg.durationMonths)} video
            </span>
          ) : null}
        </div>
        <fieldset className="rounded-xl border border-line p-4 md:col-span-2">
          <legend className="px-1 text-sm font-semibold text-ink">Ücretsiz denemeden satın alma kuralı</legend>
          <div className="grid gap-4 md:grid-cols-2">
            <Checkbox
              name="trialCountsTowardPackage"
              defaultChecked={pkg?.trialCountsTowardPackage ?? true}
              label="3 deneme videosu bu paketin video hakkına dahil sayılır"
              description="Ör. 30 videoluk pakette 3 deneme + 27 yeni video = 30. İşaretli değilse deneme videoları pakete ek sayılır."
            />
            <Field label="Kalan ilk teslim videoları (iş günü)" htmlFor="trialConversionBusinessDays" optional hint="Boş = Sistem Ayarları'ndaki değer.">
              <Input id="trialConversionBusinessDays" name="trialConversionBusinessDays" type="number" min={1} max={60} defaultValue={pkg?.trialConversionBusinessDays ?? ""} />
            </Field>
          </div>
        </fieldset>
        <Field label="Teslimat koşulları" htmlFor="deliveryTerms" className="md:col-span-2">
          <Textarea id="deliveryTerms" name="deliveryTerms" rows={2} defaultValue={pkg?.deliveryTerms ?? ""} />
        </Field>
      </div>

      <fieldset className="rounded-xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Dahil formatlar</legend>
        <div className="flex flex-wrap gap-5">
          {VIDEO_FORMATS.map((f) => (
            <Checkbox key={f} name="includedFormats" value={f} defaultChecked={pkg ? pkg.includedFormats.includes(f) : true} label={t.enums.videoFormat[f]} />
          ))}
        </div>
      </fieldset>
      <fieldset className="rounded-xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Dahil video tarzları</legend>
        <div className="flex flex-wrap gap-5">
          {VIDEO_STYLES.map((s) => (
            <Checkbox key={s} name="includedStyles" value={s} defaultChecked={pkg ? pkg.includedStyles.includes(s) : true} label={t.enums.videoStyle[s]} />
          ))}
        </div>
      </fieldset>

      <Field label="Öne çıkan özellikler" htmlFor="features" optional hint="Her satır bir madde (en fazla 12).">
        <Textarea id="features" name="features" rows={3} defaultValue={pkg?.features.join("\n") ?? ""} />
      </Field>

      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Durum" htmlFor="status">
          <Select id="status" name="status" defaultValue={pkg?.status ?? "DRAFT"}>
            <option value="DRAFT">Taslak (sitede görünmez)</option>
            <option value="PUBLISHED">Yayında</option>
            <option value="ARCHIVED">Arşiv (satıştan kaldırıldı)</option>
          </Select>
        </Field>
        <Field label="Sıra" htmlFor="sortOrder">
          <Input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={pkg?.sortOrder ?? 0} />
        </Field>
        <div className="space-y-3 pt-7">
          <Checkbox name="isFeatured" defaultChecked={pkg?.isFeatured ?? false} label="Öne çıkar" />
          <Checkbox
            name="isSample"
            defaultChecked={pkg?.isSample ?? false}
            label="Örnek veri"
            description="Örnek paketler üretimde satılamaz ve fiyatları gösterilmez."
          />
        </div>
      </div>
    </ActionForm>
  );
}
