import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/guards";
import { AdminPage, Section } from "../../_ui";
import { PackageForm } from "../package-form";

export const metadata: Metadata = { title: "Yeni Paket" };

export default function NewPackagePage() {
  return (
    <AdminPage title="Yeni paket">
      <Content />
    </AdminPage>
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
