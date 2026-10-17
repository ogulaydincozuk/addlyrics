import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });
// Logodaki italik "Lyrics" yazısı için yüksek kontrastlı serif
const logoSerif = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-logo-serif",
  style: ["italic"],
  weight: ["600"],
  display: "swap",
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jakarta",
  weight: ["600", "700", "800"],
  display: "swap",
});

const appUrl = process.env.APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "AddLyrics — Şarkına Özel Lyrics Video Hazırlama",
    template: "%s | AddLyrics",
  },
  description:
    "Profesyonel editörlerin hazırladığı şarkıya özel lyrics videolar. Aylık lyrics video paketini seç, şarkını gönder, videolarını panelden teslim al.",
  applicationName: "AddLyrics",
  openGraph: { type: "website", locale: "tr_TR", siteName: "AddLyrics" },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f8fafc",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={`${inter.variable} ${jakarta.variable} ${logoSerif.variable}`} data-scroll-behavior="smooth">
      <body className="min-h-dvh bg-canvas text-ink">{children}</body>
    </html>
  );
}
