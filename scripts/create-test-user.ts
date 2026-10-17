/**
 * Yalnızca geliştirme: üç test hesabı oluşturur (varsa şifresini ve doğrulamalarını yeniler).
 * Bilgiler .env'den okunur — .env git'e girmez. Tanımlı olmayan hesap atlanır.
 *   Yönetici:  TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_ADMIN_NAME
 *   Müşteri:   TEST_USER_EMAIL, TEST_USER_PASSWORD, TEST_USER_PHONE, TEST_USER_NAME
 *              (e-posta + telefon doğrulanmış, KVKK onaylı — ücretsiz deneme başlatabilir)
 *   İş ortağı: TEST_PARTNER_EMAIL, TEST_PARTNER_PASSWORD, TEST_PARTNER_NAME (marka adı)
 *              (aktif iş ortağı kaydına bağlı panel hesabı; referans kodunu yönetici panelden tanımlar)
 *   npm run test-user
 * Şifreler en az 10 karakter. Yerel olmayan bir veritabanında veya NODE_ENV=production iken çalışmaz.
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaClient, type Prisma, type Role } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { KVKK_VERSION } from "../src/lib/legal";
import { MAX_ACCOUNTS_PER_PHONE, normalizePhone } from "../src/lib/phone";

const db = new PrismaClient();

function assertLocal() {
  if (process.env.NODE_ENV === "production") throw new Error("Bu betik üretimde çalıştırılamaz.");
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`Bu betik yalnızca yerel veritabanında çalışır (DATABASE_URL sunucusu: ${host}).`);
  }
}

type Account = { label: string; role: Role; email: string; password: string; name: string };

function readAccount(prefix: string, label: string, role: Role, defaultName: string): Account | null {
  const email = process.env[`${prefix}_EMAIL`]?.trim().toLowerCase();
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email && !password) return null;
  if (!email || !password) throw new Error(`${prefix}_EMAIL ve ${prefix}_PASSWORD birlikte tanımlı olmalı.`);
  if (password.length < 10) throw new Error(`${prefix}_PASSWORD en az 10 karakter olmalı.`);
  return { label, role, email, password, name: process.env[`${prefix}_NAME`]?.trim() || defaultName };
}

/** Hesabı oluşturur veya şifresini yeniler; başka roldeki mevcut bir hesabın rolünü asla değiştirmez. */
async function upsertAccount(tx: Prisma.TransactionClient, a: Account, extra: { phone?: string; phoneVerifiedAt?: Date }) {
  const existing = await tx.user.findUnique({ where: { email: a.email }, select: { role: true } });
  if (existing && existing.role !== a.role) throw new Error(`${a.email} zaten ${existing.role} rolünde; ${a.label} için başka bir e-posta seç.`);
  const now = new Date();
  const data = {
    passwordHash: await hash(a.password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
    emailVerifiedAt: now,
    kvkkAcceptedAt: now,
    kvkkVersion: KVKK_VERSION,
    disabledAt: null,
    ...extra,
  };
  const user = await tx.user.upsert({
    where: { email: a.email },
    create: { email: a.email, name: a.name, role: a.role, ...data },
    update: data,
    select: { id: true },
  });
  // Şifre yenilendiği için eski oturumlar kapatılır
  await tx.session.deleteMany({ where: { userId: user.id } });
  return { id: user.id, created: !existing };
}

async function admin(a: Account) {
  const u = await db.$transaction((tx) => upsertAccount(tx, a, {}));
  console.log(`✓ ${a.label}: ${a.email} (${u.created ? "oluşturuldu" : "güncellendi"}) → /admin`);
}

async function customer(a: Account) {
  const phone = normalizePhone(process.env.TEST_USER_PHONE ?? "");
  if (!phone.ok) throw new Error(`TEST_USER_PHONE geçersiz: ${phone.error}`);
  const u = await db.$transaction(async (tx) => {
    const u = await upsertAccount(tx, a, { phone: phone.e164, phoneVerifiedAt: new Date() });
    // Telefon başına hesap sınırı test hesabı için de geçerlidir: numara değiştiyse eski yuva bırakılır
    await tx.$executeRaw`DELETE FROM "PhoneAccountSlot" WHERE "userId" = ${u.id} AND "phone" <> ${phone.e164}`;
    for (let slot = 1; slot <= MAX_ACCOUNTS_PER_PHONE; slot++) {
      const rows = await tx.$queryRaw<Array<{ slot: number }>>`
        INSERT INTO "PhoneAccountSlot" ("id", "phone", "slot", "userId", "createdAt")
        VALUES (${`ps_${randomBytes(9).toString("base64url")}`}, ${phone.e164}, ${slot}, ${u.id}, NOW())
        ON CONFLICT DO NOTHING
        RETURNING "slot"`;
      if (rows.length) break;
    }
    const claimed = await tx.phoneAccountSlot.findUnique({ where: { userId: u.id }, select: { phone: true } });
    if (claimed?.phone !== phone.e164) {
      throw new Error(`${phone.e164} numarasına zaten ${MAX_ACCOUNTS_PER_PHONE} hesap bağlı; TEST_USER_PHONE'u değiştir.`);
    }
    return u;
  });
  console.log(`✓ ${a.label}: ${a.email} (${u.created ? "oluşturuldu" : "güncellendi"}) → /panel — e-posta, telefon ve KVKK onaylı`);

  const state = await db.user.findUniqueOrThrow({
    where: { id: u.id },
    select: { trialApplication: { select: { number: true, status: true } }, _count: { select: { entitlements: true } } },
  });
  if (state.trialApplication) console.log(`  Not: deneme başvurusu var (${state.trialApplication.number}, ${state.trialApplication.status}); yeni deneme için başka e-posta kullan.`);
  if (state._count.entitlements) console.log(`  Not: ${state._count.entitlements} paket hakkı var; ücretsiz deneme yalnızca paketi olmayanlara açılır.`);
}

async function partner(a: Account) {
  const result = await db.$transaction(async (tx) => {
    const u = await upsertAccount(tx, a, {});
    const linked = await tx.partner.findUnique({ where: { userId: u.id }, select: { id: true } });
    const p = linked
      ? await tx.partner.update({ where: { id: linked.id }, data: { active: true }, select: { id: true, name: true } })
      : await tx.partner.create({
          data: { name: a.name, email: a.email, userId: u.id, active: true, notes: "Yerel test iş ortağı (npm run test-user)" },
          select: { id: true, name: true },
        });
    const codes = await tx.referralCode.count({ where: { partnerId: p.id } });
    return { ...u, partner: p, codes };
  });
  console.log(`✓ ${a.label}: ${a.email} (${result.created ? "oluşturuldu" : "güncellendi"}) → /ortak — iş ortağı kaydı: ${result.partner.name}`);
  if (!result.codes) console.log("  Not: henüz referans kodu yok; yönetici Yönetim → Referans Kodları'ndan bu iş ortağına kod tanımlamalı.");
}

async function main() {
  assertLocal();
  const accounts = [
    readAccount("TEST_ADMIN", "Yönetici", "ADMIN", "Test Yönetici"),
    readAccount("TEST_USER", "Müşteri", "CUSTOMER", "Test Müşteri"),
    readAccount("TEST_PARTNER", "İş ortağı", "PARTNER", "Test Marka"),
  ];
  if (accounts.every((a) => !a)) throw new Error("Hiçbir test hesabı tanımlı değil (.env: TEST_ADMIN_*, TEST_USER_*, TEST_PARTNER_*).");
  const emails = accounts.filter(Boolean).map((a) => a!.email);
  if (new Set(emails).size !== emails.length) throw new Error("Test hesaplarının e-postaları birbirinden farklı olmalı.");

  const [adminAcc, customerAcc, partnerAcc] = accounts;
  if (adminAcc) await admin(adminAcc);
  if (customerAcc) await customer(customerAcc);
  if (partnerAcc) await partner(partnerAcc);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
