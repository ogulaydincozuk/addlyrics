import { requirePartner } from "@/server/auth/guards";

// İş ortaklığı alanı özeldir: yetki kontrolü tamamlanmadan hiçbir şey gönderilmez (engelleyici render).
// Yetkisiz kullanıcılar alanın varlığını görmez ve gerçek 404 durum kodu alır.
export const instant = false;

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  await requirePartner();
  return children;
}
