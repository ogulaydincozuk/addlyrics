import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// İçerik Güvenlik Politikası. S3/R2 doğrudan yüklemeleri ve imzalı indirmeler için https: bağlantılarına izin verilir.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https:${isDev ? " ws: http://localhost:*" : ""}`,
  // Portfolyodaki TikTok örnekleri resmî gömülü oynatıcıyla gösterilir
  "frame-src https://www.tiktok.com",
  "frame-ancestors 'none'",
  "form-action 'self' https:",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Düşük bellekli makinelerde derleme işçisi sayısını sınırlamak için: NEXT_BUILD_CPUS=2 npm run build
    ...(process.env.NEXT_BUILD_CPUS ? { cpus: Number(process.env.NEXT_BUILD_CPUS) } : {}),
    // Disk alanı dar makinelerde geliştirme önbelleğini (~1 GB, .next/dev/cache) kapatmak için: NEXT_DEV_DISK_CACHE=off
    ...(process.env.NEXT_DEV_DISK_CACHE === "off" ? { turbopackFileSystemCacheForDev: false } : {}),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
