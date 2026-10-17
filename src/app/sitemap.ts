import type { MetadataRoute } from "next";
import { CONTENT_PAGE_SLUGS } from "@/content/settings";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const main = [
    { path: "/", priority: 1 },
    { path: "/paketler", priority: 0.9 },
    { path: "/ornekler", priority: 0.8 },
    { path: "/sss", priority: 0.7 },
    { path: "/iletisim", priority: 0.5 },
  ];
  return [
    ...main.map((p) => ({ url: `${base}${p.path}`, changeFrequency: "weekly" as const, priority: p.priority })),
    ...CONTENT_PAGE_SLUGS.map((slug) => ({ url: `${base}/${slug}`, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
