"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { VIDEO_STYLES } from "@/lib/enums";
import { emailSchema, flattenErrors } from "@/lib/validation";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/domain/errors";

const editorSchema = z.object({
  name: z.string().trim().min(2, "Editör adını yaz.").max(80),
  email: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), emailSchema.optional()),
  specialties: z.array(z.enum(VIDEO_STYLES)),
  notes: z.string().trim().max(1000).optional(),
  active: z.boolean(),
});

export async function saveEditorAction(editorId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = editorSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") ?? undefined,
    specialties: formData.getAll("specialties"),
    notes: formData.get("notes") ?? undefined,
    active: formData.get("active") === "on",
  });
  if (!parsed.success) return { ok: false, errors: flattenErrors(parsed.error) };
  const data = { ...parsed.data, email: parsed.data.email ?? null, notes: parsed.data.notes || null };
  try {
    if (editorId) await db.editor.update({ where: { id: editorId }, data });
    else await db.editor.create({ data });
  } catch (err) {
    if (isUniqueViolation(err, "email")) return { ok: false, errors: { email: "Bu e-posta başka bir editörde kayıtlı." } };
    throw err;
  }
  refresh();
  return { ok: true, message: editorId ? "Editör güncellendi." : "Editör eklendi." };
}
