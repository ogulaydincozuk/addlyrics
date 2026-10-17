import { db } from "@/server/db";
import type { OrderInput } from "@/lib/validation";

/** Tüm tabloları boşaltır (yalnızca test veritabanında çağrılır). */
export async function resetDb() {
  if (!process.env.DATABASE_URL?.includes("addlyrics_test")) {
    throw new Error("resetDb yalnızca test veritabanında çalıştırılabilir.");
  }
  const tables = await db.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (tables.length) {
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
}

let seq = 0;

export async function createUser(role: "CUSTOMER" | "ADMIN" | "PARTNER" = "CUSTOMER") {
  seq += 1;
  return db.user.create({
    data: { email: `user${seq}-${Date.now()}@test.local`, name: `Test Kullanıcı ${seq}`, passwordHash: "x", role },
  });
}

export async function createPackage(overrides: Partial<Parameters<typeof db.package.create>[0]["data"]> = {}) {
  seq += 1;
  return db.package.create({
    data: {
      slug: `paket-${seq}-${Date.now()}`,
      name: "Test Paketi",
      durationMonths: 1,
      priceKurus: 250000,
      videoCount: 4,
      deliveryTerms: "Planlı teslim",
      includedFormats: ["VERTICAL", "HORIZONTAL"],
      includedStyles: ["MINIMAL", "FILM_EDIT", "MUSIC_VIDEO"],
      status: "PUBLISHED",
      ...overrides,
    },
  });
}

export function orderInput(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    song: {
      artistName: "Test Sanatçı",
      title: "Test Şarkı",
      releaseStatus: "UPCOMING",
      language: "Türkçe",
      lyrics: "Birinci satır\nİkinci satır",
    },
    style: { style: "MINIMAL" },
    format: { formats: ["VERTICAL"], platforms: ["TIKTOK"], videoCount: 2 },
    fileIds: [],
    rightsConfirmed: true,
    termsAccepted: true,
    ...overrides,
  };
}

export async function uploadedFile(
  ownerId: string,
  kind: "SONG_AUDIO" | "LYRICS" | "MUSIC_VIDEO" | "IMAGE" | "FOOTAGE" | "DELIVERABLE" | "TRIAL_MASTER" | "TRIAL_PREVIEW" | "TRIAL_POSTER",
  sizeBytes = 1024,
) {
  seq += 1;
  return db.uploadedFile.create({
    data: {
      ownerId,
      kind,
      storageKey: `test/${ownerId}/${seq}-${Date.now()}`,
      originalName: kind === "SONG_AUDIO" ? "sarki.mp3" : kind === "TRIAL_POSTER" ? "kapak.png" : "dosya.mp4",
      mimeType: kind === "SONG_AUDIO" ? "audio/mpeg" : kind === "TRIAL_POSTER" ? "image/png" : "video/mp4",
      sizeBytes: BigInt(sizeBytes),
      status: "UPLOADED",
      uploadedAt: new Date(),
    },
  });
}

/** E-postası ve telefonu doğrulanmış müşteri (deneme başlatabilir) */
export async function createVerifiedUser(phone = `+90532${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`) {
  const user = await createUser();
  return db.user.update({ where: { id: user.id }, data: { phone, phoneVerifiedAt: new Date(), emailVerifiedAt: new Date() } });
}

export const sessionOf = (u: { id: string; email: string; name: string; role: "CUSTOMER" | "ADMIN" | "PARTNER" | "EDITOR" }) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  artistName: null,
  role: u.role,
});

export const billing = {
  billingName: "Test Kullanıcı",
  billingPhone: "05551234567",
  billingCity: "İstanbul",
  billingAddress: "Test Mahallesi, Test Sokak No: 1",
};
