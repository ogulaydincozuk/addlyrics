// Dil yapılandırması. İlk sürüm yalnızca Türkçe yayınlanır.
// İngilizce eklemek için: `src/i18n/en.ts` oluşturup `dictionaries` içine ekleyin,
// `locales` dizisine "en" ekleyin ve içerik tablolarında (SiteSetting, FaqItem, ContentPage)
// locale="en" kayıtları oluşturun. Ayrıntılar: docs/ARCHITECTURE.md → Çok dillilik.
import { tr } from "./tr";

export const locales = ["tr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "tr";

const dictionaries = { tr } as const;

export type Messages = typeof tr;

export function getMessages(locale: Locale = defaultLocale): Messages {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

/** Bileşenlerde kısa kullanım: `const t = messages()` */
export const messages = getMessages;
