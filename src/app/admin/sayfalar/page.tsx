import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge } from "@/components/ui/primitives";
import { CONTENT_PAGE_SLUGS } from "@/content/settings";
import { formatDateTime } from "@/lib/dates";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { AdminPage, Table, Td, Th } from "../_ui";

export const metadata: Metadata = { title: "Sayfalar ve Yasal Metinler" };

export default function PagesAdminPage() {
  return (
    <AdminPage title="Sayfalar ve Yasal Metinler" description="Hakkımızda ve yasal metinler. Hukuki metinler bir uzman tarafından incelenene kadar taslak olarak işaretlenir.">
      <Pages />
    </AdminPage>
  );
}

async function Pages() {
  await requireAdmin();
  const pages = await db.contentPage.findMany({ where: { locale: "tr" } });
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  return (
    <div className="space-y-4">
      <Alert tone="warning" title="Hukuki inceleme">
        Bu metinler başlangıç taslaklarıdır; KVKK, Mesafeli Sözleşmeler Yönetmeliği ve tüketici mevzuatı açısından bir hukuk danışmanına
        inceletilmeden &quot;incelendi&quot; olarak işaretlenmemelidir. İncelenmemiş metinlerde sitede taslak uyarısı görünür.
      </Alert>
      <Table minWidth={640}>
        <thead>
          <tr>
            <Th>Sayfa</Th>
            <Th>Durum</Th>
            <Th>Son güncelleme</Th>
          </tr>
        </thead>
        <tbody>
          {CONTENT_PAGE_SLUGS.map((slug) => {
            const p = bySlug.get(slug);
            return (
              <tr key={slug} className="hover:bg-canvas">
                <Td>
                  <Link href={`/admin/sayfalar/${slug}`} className="font-semibold text-brand hover:underline">
                    {p?.title ?? slug}
                  </Link>
                  <p className="text-xs text-muted">/{slug}</p>
                </Td>
                <Td>
                  {!p ? (
                    <Badge tone="danger">Oluşturulmadı</Badge>
                  ) : !p.isLegal ? (
                    <Badge tone="neutral">İçerik</Badge>
                  ) : p.reviewedAt ? (
                    <Badge tone="success">İncelendi</Badge>
                  ) : (
                    <Badge tone="warning">Taslak</Badge>
                  )}
                </Td>
                <Td className="text-muted">{p ? formatDateTime(p.updatedAt) : "—"}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
