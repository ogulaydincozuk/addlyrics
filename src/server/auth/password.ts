import "server-only";
import { hash, verify } from "@node-rs/argon2";

// OWASP önerisi: Argon2id, m=19 MiB, t=2, p=1
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string) {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Kullanıcı bulunamadığında da benzer sürede yanıt vermek için (zamanlama saldırılarına karşı)
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string) {
  dummyHash ??= hashPassword("addlyrics-timing-equalizer");
  await verifyPassword(await dummyHash, password);
}
