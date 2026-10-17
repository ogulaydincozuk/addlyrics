import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { toDateInputValue } from "@/lib/dates";
import { kurusToDecimalString } from "@/lib/money";
import { COMMISSION_BASE_LABEL, type CommissionBaseValue } from "@/lib/referral";

export function PartnerFields({
  defaults,
}: {
  defaults?: { name: string; email: string | null; phone: string | null; social: string; notes: string | null; active: boolean };
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Ad / sayfa adı" htmlFor="name">
        <Input id="name" name="name" defaultValue={defaults?.name} required maxLength={120} />
      </Field>
      <Field label="E-posta" htmlFor="email" optional>
        <Input id="email" name="email" type="email" defaultValue={defaults?.email ?? ""} />
      </Field>
      <Field label="Telefon" htmlFor="phone" optional>
        <Input id="phone" name="phone" defaultValue={defaults?.phone ?? ""} />
      </Field>
      <Field label="Sosyal medya hesapları" htmlFor="social" optional hint="Her satıra bir hesap: platform: kullanıcı adı veya bağlantı">
        <Textarea id="social" name="social" rows={3} defaultValue={defaults?.social ?? ""} placeholder={"instagram: @ornekrap\ntiktok: @ornekrap"} />
      </Field>
      <Field label="Notlar (yalnızca yöneticiler görür)" htmlFor="notes" optional className="sm:col-span-2">
        <Textarea id="notes" name="notes" rows={2} defaultValue={defaults?.notes ?? ""} />
      </Field>
      <Checkbox name="active" label="Aktif" description="Pasif iş ortağının kodları çalışmaz ve paneline erişemez." defaultChecked={defaults?.active ?? true} />
    </div>
  );
}

export type CodeDefaults = {
  code: string;
  partnerId: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  commissionRateBps: number;
  commissionBase: CommissionBaseValue;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  active: boolean;
  packageIds: string[];
};

export function CodeFields({
  partners,
  packages,
  defaults,
  fixedPartnerId,
}: {
  partners: Array<{ id: string; name: string; active: boolean }>;
  packages: Array<{ id: string; name: string }>;
  defaults?: CodeDefaults;
  fixedPartnerId?: string;
}) {
  const discountShown = defaults
    ? defaults.discountType === "PERCENT"
      ? String(defaults.discountValue / 100).replace(".", ",")
      : kurusToDecimalString(defaults.discountValue)
    : "";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Kod" htmlFor="code" hint="4–24 karakter; harf, rakam, tire. Büyük harfe çevrilir.">
        <Input id="code" name="code" defaultValue={defaults?.code} required maxLength={24} className="uppercase" />
      </Field>
      {fixedPartnerId ? (
        <input type="hidden" name="partnerId" value={fixedPartnerId} />
      ) : (
        <Field label="İş ortağı" htmlFor="partnerId">
          <Select id="partnerId" name="partnerId" defaultValue={defaults?.partnerId ?? ""} required>
            <option value="">Seçin…</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.active ? "" : " (pasif)"}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Müşteri indirimi türü" htmlFor="discountType">
        <Select id="discountType" name="discountType" defaultValue={defaults?.discountType ?? "PERCENT"}>
          <option value="PERCENT">Yüzde (%)</option>
          <option value="FIXED">Sabit tutar (TL)</option>
        </Select>
      </Field>
      <Field label="İndirim değeri" htmlFor="discountValue" hint="Yüzde için 10, tutar için 250,00 gibi. İndirim yoksa 0.">
        <Input id="discountValue" name="discountValue" defaultValue={discountShown} inputMode="decimal" required />
      </Field>
      <Field label="Komisyon oranı (%)" htmlFor="commissionRate" hint="Ticari anlaşmadaki oran. Varsayılan yoktur.">
        <Input id="commissionRate" name="commissionRate" defaultValue={defaults ? String(defaults.commissionRateBps / 100).replace(".", ",") : ""} inputMode="decimal" required />
      </Field>
      <Field label="Komisyon hangi tutar üzerinden?" htmlFor="commissionBase" hint="Yönetici açıkça seçmelidir; KDV oranı Sistem Ayarları'ndadır.">
        <Select id="commissionBase" name="commissionBase" defaultValue={defaults?.commissionBase ?? ""} required>
          <option value="">Seçin…</option>
          {(Object.keys(COMMISSION_BASE_LABEL) as CommissionBaseValue[]).map((b) => (
            <option key={b} value={b}>
              {COMMISSION_BASE_LABEL[b]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Başlangıç" htmlFor="startsAt" optional>
        <Input id="startsAt" name="startsAt" type="date" defaultValue={toDateInputValue(defaults?.startsAt ?? null)} />
      </Field>
      <Field label="Bitiş" htmlFor="endsAt" optional>
        <Input id="endsAt" name="endsAt" type="date" defaultValue={toDateInputValue(defaults?.endsAt ?? null)} />
      </Field>
      <Field label="Kullanım limiti" htmlFor="usageLimit" optional hint="Ödemesi doğrulanmış satış sayısı. Boş = sınırsız.">
        <Input id="usageLimit" name="usageLimit" type="number" min={1} defaultValue={defaults?.usageLimit ?? ""} />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-semibold text-ink">Geçerli paketler</legend>
        <p className="text-xs text-muted">Hiçbiri seçilmezse tüm paketlerde geçerlidir.</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {packages.map((p) => (
            <Checkbox key={p.id} name="packageIds" value={p.id} label={p.name} defaultChecked={defaults?.packageIds.includes(p.id)} />
          ))}
        </div>
      </fieldset>
      <Checkbox name="active" label="Aktif" defaultChecked={defaults?.active ?? true} />
    </div>
  );
}
