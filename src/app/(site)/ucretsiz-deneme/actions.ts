"use server";

import { redirect } from "next/navigation";
import { flattenErrors, trialInputSchema } from "@/lib/validation";
import { getSessionUser } from "@/server/auth/session";
import { isDomainError } from "@/server/domain/errors";
import { createTrialApplication } from "@/server/domain/trials";
import { rateLimitByIp } from "@/server/rate-limit";

export type TrialSubmitResult = { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Ücretsiz deneme başvurusu. Eksik/hatalı dosyalarda başvuru oluşturulmaz ve hatalar listelenir. */
export async function submitTrial(raw: unknown): Promise<TrialSubmitResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Oturumun sona ermiş. Lütfen tekrar giriş yap." };
  const limit = await rateLimitByIp("trialCreate", user.id);
  if (!limit.ok) return { ok: false, error: "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar dene." };
  const parsed = trialInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Lütfen işaretli alanları kontrol et.", fieldErrors: flattenErrors(parsed.error) };
  try {
    await createTrialApplication(user.id, parsed.data);
  } catch (err) {
    if (isDomainError(err)) return { ok: false, error: err.message };
    console.error("[trial:create]", err);
    return { ok: false, error: "Başvuru gönderilemedi. Lütfen tekrar dene." };
  }
  redirect("/panel/deneme?basvuru=1");
}
