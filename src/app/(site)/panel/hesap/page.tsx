import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { logout } from "../../(auth)/actions";
import { PanelPage } from "../_components";
import { PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Hesap Ayarları" };

export default function AccountPage() {
  return (
    <PanelPage title="Hesap Ayarları">
      <Account />
    </PanelPage>
  );
}

async function Account() {
  const session = await requireUser("/panel/hesap");
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { email: true, name: true, artistName: true, phone: true, phoneVerifiedAt: true },
  });
  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-7">
        <h2 className="mb-5 text-lg font-bold text-ink">Profil</h2>
        <ProfileForm
          defaults={{ email: user.email, name: user.name, artistName: user.artistName ?? "", phone: user.phone ?? "", phoneVerified: Boolean(user.phoneVerifiedAt) }}
        />
      </Card>
      <Card className="p-5 sm:p-7">
        <h2 className="mb-5 text-lg font-bold text-ink">Şifre</h2>
        <PasswordForm />
      </Card>
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <h2 className="text-lg font-bold text-ink">Oturum</h2>
          <p className="text-sm text-muted">Bu cihazdaki oturumunu kapat.</p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="secondary" icon={<LogOut className="size-4" aria-hidden />}>
            Çıkış Yap
          </Button>
        </form>
      </Card>
      <p className="text-sm text-muted">
        Hesabını silmek veya kişisel verilerinle ilgili bir talepte bulunmak için iletişim sayfasından bize yazabilirsin (KVKK m.11).
      </p>
    </div>
  );
}
