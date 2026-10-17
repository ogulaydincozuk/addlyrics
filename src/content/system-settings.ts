// Yönetici panelinden (Sistem Ayarları) düzenlenen işletme ayarları. Site içerik metinlerinden ayrı tutulur.
// Varsayılanlar panelde açıkça gösterilir; ticari koşullar (KDV, komisyon bekleme süresi) yöneticinin onayına tabidir.
import { z } from "zod";

export const trialSettingsSchema = z.object({
  /** Yeni deneme başvurusu alınıyor mu? */
  enabled: z.boolean(),
  /** Dosyalar doğrulandıktan sonra ön izlemeler için hedef süre (saat) */
  previewTargetHours: z.number().int().min(1).max(168),
  /** Ön izleme kesitinin uzunluğu (saniye) */
  previewSeconds: z.number().int().min(5).max(60),
  /** Ön izleme kesitinin videoda başladığı an (saniye) */
  previewStartSeconds: z.number().int().min(0).max(600),
  /** Ön izlemeye logo filigranı eklensin mi (sunucuda ffmpeg ile) */
  watermark: z.boolean(),
  /** Ön izleme hafif bulanıklaştırılsın mı */
  blur: z.boolean(),
  /** Aynı anda açık olabilecek en fazla deneme (üretim kapasitesi). Dolunca yeni başvuru alınmaz. */
  maxOpenTrials: z.number().int().min(1).max(1000),
  /** Denemeden satın almada ilk teslimin kalan videoları için iş günü (paket ayarı yoksa) */
  conversionBusinessDays: z.number().int().min(1).max(60),
  /** Satın alınmayan denemelerin dosyalarının saklanma süresi (gün) */
  retentionDays: z.number().int().min(7).max(730),
});

export const commerceSettingsSchema = z.object({
  /** KDV hariç komisyon hesabında kullanılan oran (%) */
  vatRatePercent: z.number().min(0).max(100),
  /** Komisyonun onaylanabilmesi için ödemeden sonra beklenecek gün (iade/cayma süresi) */
  commissionHoldDays: z.number().int().min(0).max(365),
});

export const SYSTEM_SETTING_SCHEMAS = {
  "system.trial": trialSettingsSchema,
  "system.commerce": commerceSettingsSchema,
} as const;

export type SystemSettingKey = keyof typeof SYSTEM_SETTING_SCHEMAS;
export type SystemSettingValue<K extends SystemSettingKey> = z.infer<(typeof SYSTEM_SETTING_SCHEMAS)[K]>;

export const DEFAULT_SYSTEM_SETTINGS: { [K in SystemSettingKey]: SystemSettingValue<K> } = {
  "system.trial": {
    enabled: true,
    previewTargetHours: 24,
    previewSeconds: 20,
    previewStartSeconds: 10,
    watermark: true,
    blur: false,
    maxOpenTrials: 25,
    conversionBusinessDays: 5,
    retentionDays: 90,
  },
  "system.commerce": {
    vatRatePercent: 20,
    commissionHoldDays: 14,
  },
};
