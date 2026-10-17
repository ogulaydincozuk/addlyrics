import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/server/auth/guards";
import { AdminPage, Section } from "../../_ui";
import { PackageForm } from "../package-form";

export const metadata: Metadata = { title: "Yeni Paket" };

export default function NewPackagePage() {
  return (
    <div>
      <Link href="/admin/paketler" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand">
        <ArrowLeft className="size-4" aria-hidden /> Paketler
      </Link>
      <AdminPage title="Yeni paket">
        <Content />
      </AdminPage>
    </div>
  );
}

async function Content() {
  await requireAdmin();
  return (
    <Section title="Paket bilgileri">
      <PackageForm pkg={null} />
    </Section>
  );
}
