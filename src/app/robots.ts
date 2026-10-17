import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/panel", "/siparis", "/odeme", "/api", "/giris", "/kayit"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
