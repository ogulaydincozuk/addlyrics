import type { Metadata } from "next";
import type { PortfolioItem } from "@prisma/client";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Alert, Badge } from "@/components/ui/primitives";
import { messages } from "@/i18n/config";
import { PORTFOLIO_CATEGORIES, VIDEO_FORMATS } from "@/lib/enums";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { publicFileRules } from "@/server/storage/file-rules";
import { ActionForm } from "../_forms";
import { AdminPage, Section } from "../_ui";
import { addTikTokItemAction, deleteItemAction, updateItemAction } from "./actions";
import { UploadItemForm } from "./upload-item-form";

export const metadata: Metadata = { title: "Portfolyo" };

export default function PortfolioAdminPage() {
  return (
    <AdminPage title="Portfolyo" description="Sitedeki video örnekleri. Yalnızca kullanım hakkı bulunan videoları yayınlayın.">
      <Portfolio />
    </AdminPage>
  );
}

function BaseFields({ item, idPrefix }: { item: Partial<PortfolioItem> | null; idPrefix: string }) {
  const t = messages();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Başlık" htmlFor={`${idPrefix}-title`}>
        <Input id={`${idPrefix}-title`} name="title" defaultValue={item?.title ?? ""} />
      </Field>
      <Field label="Kısa açıklama" htmlFor={`${idPrefix}-desc`}>
        <Input id={`${idPrefix}-desc`} name="description" defaultValue={item?.description ?? ""} />
      </Field>
      <Field label="Kategori" htmlFor={`${idPrefix}-cat`}>
        <Select id={`${idPrefix}-cat`} name="category" defaultValue={item?.category ?? "FILM_EDIT"}>
          {PORTFOLIO_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t.enums.videoStyleShort[c]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Format" htmlFor={`${idPrefix}-or`}>
        <Select id={`${idPrefix}-or`} name="orientation" defaultValue={item?.orientation ?? "VERTICAL"}>
          {VIDEO_FORMATS.map((f) => (
            <option key={f} value={f}>
              {t.enums.videoFormat[f]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Sıra" htmlFor={`${idPrefix}-so`}>
        <Input id={`${idPrefix}-so`} name="sortOrder" type="number" min={0} defaultValue={item?.sortOrder ?? 0} />
      </Field>
      <div className="pt-7">
        <Checkbox name="published" defaultChecked={item?.published ?? true} label="Sitede yayında" />
      </div>
    </div>
  );
}

async function Portfolio() {
  await requireAdmin();
  const t = messages();
  const items = await db.portfolioItem.findMany({ orderBy: [{ published: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }] });
  const rules = publicFileRules();
  return (
    <div className="space-y-6">
      <Alert tone="info">
        TikTok örnekleri resmî gömülü oynatıcıyla gösterilir; video indirilmez veya yeniden barındırılmaz. Başkasına ait içerikleri yalnızca
        izin alarak ve AddLyrics işi olarak sunmadan kullanın. &quot;Stil önizlemesi&quot; öğeleri gerçek müşteri işi değildir.
      </Alert>

      <Section title="TikTok bağlantısıyla ekle">
        <ActionForm action={addTikTokItemAction} submitLabel="Örneği ekle">
          <Field label="TikTok video bağlantısı" htmlFor="tt-url" hint="vt.tiktok.com/… kısa bağlantısı veya tiktok.com/@kullanici/video/… adresi">
            <Input id="tt-url" name="url" type="url" placeholder="https://vt.tiktok.com/…" />
          </Field>
          <BaseFields item={null} idPrefix="tt" />
        </ActionForm>
      </Section>

      <Section title="Video yükleyerek ekle">
        <UploadItemForm videoRule={rules.PORTFOLIO_VIDEO} posterRule={rules.PORTFOLIO_POSTER}>
          <BaseFields item={null} idPrefix="up" />
        </UploadItemForm>
      </Section>

      <div className="space-y-4">
        {items.map((item) => (
          <Section
            key={item.id}
            title={item.title}
            description={`${t.enums.videoStyleShort[item.category]} · ${t.enums.videoFormat[item.orientation]}`}
            actions={
              <div className="flex flex-wrap gap-2">
                {item.isDemo && <Badge tone="warning">Stil önizlemesi</Badge>}
                {item.embedProvider === "tiktok" && <Badge tone="info">TikTok @{item.authorHandle}</Badge>}
                {item.videoFileId && <Badge tone="info">Yüklenen video</Badge>}
                <Badge tone={item.published ? "success" : "neutral"}>{item.published ? "Yayında" : "Gizli"}</Badge>
              </div>
            }
          >
            {item.sourceUrl && (
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="mb-3 inline-block break-all text-sm text-brand hover:underline">
                {item.sourceUrl}
              </a>
            )}
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-brand">Düzenle</summary>
              <div className="mt-4 space-y-3">
                <ActionForm action={updateItemAction.bind(null, item.id)} submitLabel="Kaydet">
                  <BaseFields item={item} idPrefix={item.id} />
                </ActionForm>
                <ActionForm action={deleteItemAction.bind(null, item.id)} submitLabel="Örneği sil" variant="ghost" confirm="Bu örnek silinsin mi?" />
              </div>
            </details>
          </Section>
        ))}
      </div>
    </div>
  );
}
