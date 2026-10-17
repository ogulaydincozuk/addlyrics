import { appUrl } from "@/server/env";
import { confirmByToken } from "@/server/payments/service";

/**
 * iyzico Checkout Form dönüşü. iyzico müşteriyi bu adrese `token` ile POST eder.
 * Gelen veriye güvenilmez: sonuç token ile iyzico API'sinden sunucu-sunucu sorgulanır.
 * Oturum çerezi (SameSite=Lax) bu çapraz site POST isteğinde gelmez; gerekmez de.
 */
export async function POST(request: Request) {
  let token = "";
  try {
    const form = await request.formData();
    token = String(form.get("token") ?? "");
  } catch {
    token = "";
  }
  if (!token || token.length > 200) return redirect303("/panel/siparislerim");

  try {
    const result = await confirmByToken("IYZICO", token);
    if (!result) return redirect303("/panel/siparislerim");
    return redirect303(`/siparis/${result.orderNumber}/sonuc`);
  } catch (err) {
    // Sağlayıcıya erişilemezse sonuç sayfası bekleme durumunu gösterir; webhook daha sonra tamamlar
    console.error("[iyzico:callback]", err);
    return redirect303("/panel/siparislerim");
  }
}

function redirect303(path: string) {
  return new Response(null, { status: 303, headers: { Location: appUrl(path), "Cache-Control": "no-store" } });
}
