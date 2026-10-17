import "server-only";
import type { AnnouncementDisplay } from "@prisma/client";
import { audit } from "../audit";
import type { SessionUser } from "../auth/session";
import { db } from "../db";
import { DomainError } from "./errors";

export type AnnouncementInput = {
  title: string;
  body: string;
  linkLabel: string | null;
  linkUrl: string | null;
  display: AnnouncementDisplay;
  startsAt: Date | null;
  endsAt: Date | null;
  priority: number;
};

function assertAdmin(actor: Pick<SessionUser, "id" | "role">) {
  if (actor.role !== "ADMIN") throw new DomainError("Bu işlem için yönetici yetkisi gerekir.", "FORBIDDEN");
}

function validate(input: AnnouncementInput) {
  if (input.title.trim().length < 3) throw new DomainError("Başlık en az 3 karakter olmalı.");
  if (input.body.trim().length < 5) throw new DomainError("Açıklama yazın.");
  if (input.linkUrl && !/^(https:\/\/|\/)/.test(input.linkUrl)) throw new DomainError("Bağlantı https:// veya / ile başlamalı.");
  if (input.linkUrl && !input.linkLabel) throw new DomainError("Bağlantı için buton metni yazın.");
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw new DomainError("Bitiş tarihi başlangıçtan sonra olmalı.");
}

export async function saveAnnouncement(actor: Pick<SessionUser, "id" | "role">, id: string | null, input: AnnouncementInput) {
  assertAdmin(actor);
  validate(input);
  const data = {
    title: input.title.trim(),
    body: input.body.trim(),
    linkLabel: input.linkLabel?.trim() || null,
    linkUrl: input.linkUrl?.trim() || null,
    display: input.display,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    priority: input.priority,
  };
  const saved = id
    ? await db.announcement.update({ where: { id }, data })
    : await db.announcement.create({ data: { ...data, status: "DRAFT", createdById: actor.id } });
  await audit({ actorId: actor.id, action: id ? "announcement.update" : "announcement.create", entityType: "Announcement", entityId: saved.id, summary: saved.title });
  return saved;
}

export async function setAnnouncementStatus(actor: Pick<SessionUser, "id" | "role">, id: string, publish: boolean) {
  assertAdmin(actor);
  const saved = await db.announcement.update({
    where: { id },
    data: publish ? { status: "PUBLISHED", publishedAt: new Date() } : { status: "UNPUBLISHED" },
  });
  await audit({ actorId: actor.id, action: publish ? "announcement.publish" : "announcement.unpublish", entityType: "Announcement", entityId: id, summary: saved.title });
  return saved;
}

/** Yalnızca hiç yayınlanmamış taslaklar silinebilir; yayın geçmişi olanlar yayından kaldırılır. */
export async function deleteAnnouncement(actor: Pick<SessionUser, "id" | "role">, id: string) {
  assertAdmin(actor);
  const a = await db.announcement.findUnique({ where: { id } });
  if (!a) return;
  if (a.publishedAt) throw new DomainError("Yayınlanmış duyuru silinemez; yayından kaldırın.");
  await db.announcement.delete({ where: { id } });
  await audit({ actorId: actor.id, action: "announcement.delete", entityType: "Announcement", entityId: id, summary: a.title });
}
