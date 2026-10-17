import { NextResponse, type NextRequest } from "next/server";

/**
 * İyimser yönlendirme: oturum çerezi yoksa korumalı sayfalardan giriş sayfasına yönlendirir.
 * Asıl yetki kontrolü her sayfada ve sunucu eyleminde veritabanı oturumuyla yapılır
 * (bkz. src/server/auth/guards.ts) — proxy tek başına güvenlik katmanı değildir.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("al_session") || request.cookies.has("__Host-al_session");
  if (hasSession) return NextResponse.next();
  const url = request.nextUrl.clone();
  const next = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/giris";
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Yalnızca sayfa rotaları; API ve dosya yüklemeleri proxy'den geçmez (gövde boyutu sınırı uygulanmasın)
  matcher: ["/panel/:path*", "/admin/:path*", "/ortak/:path*", "/siparis/yeni"],
};
