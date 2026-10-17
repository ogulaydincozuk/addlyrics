import { beforeEach, describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";
import { db } from "@/server/db";
import { sentEmails } from "@/server/email";
import { sentSms } from "@/server/verification/sms";
import {
  claimPhoneSlot,
  confirmEmailToken,
  confirmPhoneVerification,
  sendEmailVerification,
  startPhoneVerification,
} from "@/server/verification/service";
import { createUser, resetDb } from "./helpers";

const PHONE = "+905321234567";

async function sendAndConfirm(userId: string, phone = PHONE) {
  await startPhoneVerification(userId, phone);
  const code = sentSms.filter((s) => s.phone === phone).at(-1)!.code!;
  return confirmPhoneVerification(userId, code);
}

describe("telefon normalizasyonu", () => {
  it.each([
    ["0532 123 45 67", "+905321234567"],
    ["532-123-4567", "+905321234567"],
    ["+90 (532) 123 45 67", "+905321234567"],
    ["00905321234567", "+905321234567"],
    ["+49 1512 3456789", "+4915123456789"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toEqual({ ok: true, e164: expected });
  });

  it.each(["0212 123 45 67", "12345", "abc", ""])("geçersiz: %s", (input) => {
    expect(normalizePhone(input).ok).toBe(false);
  });
});

describe("telefon doğrulama ve hesap sınırı", () => {
  beforeEach(async () => {
    await resetDb();
    sentSms.length = 0;
  });

  it("aynı telefonla en fazla 2 hesap doğrulanır; üçüncü hesap reddedilir", async () => {
    const [a, b, c] = [await createUser(), await createUser(), await createUser()];
    await sendAndConfirm(a.id);
    await sendAndConfirm(b.id);
    // Erken kontrol: üçüncü hesap kod bile isteyemez
    await expect(startPhoneVerification(c.id, PHONE)).rejects.toThrow(/en fazla 2 hesap/);
    expect(await db.phoneAccountSlot.count({ where: { phone: PHONE } })).toBe(2);
    expect((await db.user.findUniqueOrThrow({ where: { id: c.id } })).phoneVerifiedAt).toBeNull();
  });

  it("eşzamanlı doğrulamalar sınırı aşamaz (veritabanı kısıtı)", async () => {
    const users = await Promise.all(Array.from({ length: 4 }, () => createUser()));
    // Dört hesap da kodu sınıra ulaşılmadan almış olsun
    for (const u of users) await startPhoneVerification(u.id, PHONE);
    const codes = users.map((u) => sentSms.filter((s) => s.phone === PHONE)[users.indexOf(u)]!.code!);
    const results = await Promise.allSettled(users.map((u, i) => confirmPhoneVerification(u.id, codes[i]!)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(2);
    expect(await db.phoneAccountSlot.count({ where: { phone: PHONE } })).toBe(2);
    expect(await db.user.count({ where: { phone: PHONE, phoneVerifiedAt: { not: null } } })).toBe(2);
  });

  it("yuva ayırma doğrudan da en fazla iki kayda izin verir", async () => {
    const users = await Promise.all(Array.from({ length: 5 }, () => createUser()));
    const claimed = await Promise.all(users.map((u) => claimPhoneSlot(db, u.id, "+905559998877")));
    expect(claimed.filter(Boolean)).toHaveLength(2);
    await expect(db.$executeRawUnsafe(`INSERT INTO "PhoneAccountSlot" ("id","phone","slot","userId") VALUES ('x','+905559998877',3,'${users[4]!.id}')`)).rejects.toThrow();
  });

  it("hatalı kod 5 denemeden sonra kilitlenir", async () => {
    const u = await createUser();
    await startPhoneVerification(u.id, PHONE);
    for (let i = 0; i < 5; i++) await expect(confirmPhoneVerification(u.id, "000000")).rejects.toThrow();
    const code = sentSms.at(-1)!.code!;
    await expect(confirmPhoneVerification(u.id, code)).rejects.toThrow(/Çok fazla/);
  });

  it("kod tekrar isteme bekleme süresi uygulanır", async () => {
    const u = await createUser();
    await startPhoneVerification(u.id, PHONE);
    await expect(startPhoneVerification(u.id, PHONE)).rejects.toThrow(/bekle/);
  });

  it("doğrulanmış telefon değiştirilemez", async () => {
    const u = await createUser();
    await sendAndConfirm(u.id);
    await expect(startPhoneVerification(u.id, "+905339998877")).rejects.toThrow(/değiştirilemez/);
  });
});

describe("e-posta doğrulama", () => {
  beforeEach(async () => {
    await resetDb();
    sentEmails.length = 0;
  });

  it("bağlantıdaki belirteç bir kez kullanılabilir", async () => {
    const u = await createUser();
    await sendEmailVerification(u.id, "/ucretsiz-deneme");
    const mail = sentEmails.at(-1)!;
    const token = decodeURIComponent(mail.text.match(/token=([^&\s]+)/)![1]!);
    expect(await confirmEmailToken(token)).toBe(u.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).emailVerifiedAt).not.toBeNull();
    expect(await confirmEmailToken(token)).toBeNull();
    expect(await confirmEmailToken("gecersiz-belirtec-gecersiz-belirtec")).toBeNull();
  });
});
