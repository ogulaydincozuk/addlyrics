// İstemci tarafında da kullanılabilen enum değerleri.
// prisma/schema.prisma ile birebir aynı olmalıdır (tests/enums.test.ts bunu doğrular).

export const VIDEO_STYLES = ["FILM_EDIT", "MINIMAL", "MUSIC_VIDEO", "CUSTOM"] as const;
export type VideoStyleValue = (typeof VIDEO_STYLES)[number];

export const PORTFOLIO_CATEGORIES = ["FILM_EDIT", "MINIMAL", "MUSIC_VIDEO"] as const;

export const VIDEO_FORMATS = ["VERTICAL", "HORIZONTAL", "SQUARE"] as const;
export type VideoFormatValue = (typeof VIDEO_FORMATS)[number];

export const PLATFORMS = ["TIKTOK", "INSTAGRAM_REELS", "YOUTUBE_SHORTS", "YOUTUBE", "OTHER"] as const;
export type PlatformValue = (typeof PLATFORMS)[number];

export const RELEASE_STATUSES = ["RELEASED", "UPCOMING", "UNRELEASED"] as const;
export type ReleaseStatusValue = (typeof RELEASE_STATUSES)[number];

export const FOOTAGE_SOURCES = ["ADDLYRICS_LICENSED", "CUSTOMER_PROVIDED"] as const;
export type FootageSourceValue = (typeof FOOTAGE_SOURCES)[number];

export const ORDER_STATUSES = [
  "PAYMENT_PENDING",
  "NEW",
  "AWAITING_FILES",
  "ASSIGNED",
  "IN_PROGRESS",
  "IN_REVIEW",
  "READY_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const CUSTOMER_FILE_KINDS = ["SONG_AUDIO", "LYRICS", "MUSIC_VIDEO", "IMAGE", "FOOTAGE"] as const;
export const ADMIN_FILE_KINDS = ["DELIVERABLE", "PORTFOLIO_VIDEO", "PORTFOLIO_POSTER", "TRIAL_MASTER", "TRIAL_PREVIEW", "TRIAL_POSTER"] as const;
/** Ücretsiz deneme üretim dosyaları (yalnızca yönetici yükler) */
export const TRIAL_FILE_KINDS = ["TRIAL_MASTER", "TRIAL_PREVIEW", "TRIAL_POSTER"] as const;
export const FILE_KINDS = [...CUSTOMER_FILE_KINDS, ...ADMIN_FILE_KINDS] as const;
export type FileKindValue = (typeof FILE_KINDS)[number];
export type CustomerFileKind = (typeof CUSTOMER_FILE_KINDS)[number];

export const SONG_LANGUAGES = ["Türkçe", "İngilizce", "Kürtçe", "Almanca", "Arapça", "Diğer"] as const;
