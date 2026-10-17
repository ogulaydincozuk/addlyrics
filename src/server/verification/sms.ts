import "server-only";
import { env, smsProvider } from "../env";

/**
 * SMS doğrulama sağlayıcıları.
 *  - console: yalnızca geliştirme ortamı; kod sunucu günlüğüne yazılır, SMS gönderilmez.
 *  - twilio : Twilio Verify (kodu sağlayıcı üretir ve doğrular).
 * Sağlayıcı yapılandırılmamışsa SMS gönderildiği varsayılmaz; doğrulama başlatılamaz.
 */
export interface SmsVerifier {
  readonly name: "console" | "twilio";
  /** true ise kod sağlayıcıda üretilir ve doğrulanır (biz yalnızca deneme sayısını tutarız) */
  readonly managesCodes: boolean;
  send(phone: string, code: string | null): Promise<void>;
  check?(phone: string, code: string): Promise<boolean>;
}

/** Test ortamında "gönderilen" kodlar burada birikir (konsol sağlayıcısı). */
export const sentSms: Array<{ phone: string; code: string | null }> = [];

class ConsoleVerifier implements SmsVerifier {
  readonly name = "console" as const;
  readonly managesCodes = false;
  async send(phone: string, code: string | null) {
    if (env().NODE_ENV === "test") {
      sentSms.push({ phone, code });
      return;
    }
    console.info(`\n────────── [sms:console — yalnızca geliştirme] ──────────\nKime: ${phone}\nAddLyrics doğrulama kodun: ${code}\n────────────────────────────────────────────────────────\n`);
  }
}

class TwilioVerifier implements SmsVerifier {
  readonly name = "twilio" as const;
  readonly managesCodes = true;

  private async call(path: string, form: Record<string, string>) {
    const e = env();
    const auth = Buffer.from(`${e.TWILIO_ACCOUNT_SID}:${e.TWILIO_AUTH_TOKEN}`).toString("base64");
    const res = await fetch(`https://verify.twilio.com/v2/Services/${e.TWILIO_VERIFY_SERVICE_SID}/${path}`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { status?: string; valid?: boolean; message?: string };
    return { ok: res.ok, status: res.status, body };
  }

  async send(phone: string) {
    const r = await this.call("Verifications", { To: phone, Channel: "sms", Locale: "tr" });
    if (!r.ok) throw new Error(`Twilio Verify hata ${r.status}: ${r.body.message ?? ""}`.trim());
  }

  async check(phone: string, code: string) {
    const r = await this.call("VerificationCheck", { To: phone, Code: code });
    // 404: doğrulama süresi dolmuş veya bulunamadı
    if (r.status === 404) return false;
    if (!r.ok) throw new Error(`Twilio Verify hata ${r.status}: ${r.body.message ?? ""}`.trim());
    return r.body.status === "approved" || r.body.valid === true;
  }
}

export function smsVerifier(): SmsVerifier | null {
  const p = smsProvider();
  if (p === "twilio") return new TwilioVerifier();
  if (p === "console") return new ConsoleVerifier();
  return null;
}
