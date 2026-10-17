/** Kullanıcıya gösterilebilir iş kuralı hatası. */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string = "DOMAIN",
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}

export function isUniqueViolation(err: unknown, field?: string) {
  const e = err as { code?: string; meta?: { target?: string[] | string } };
  if (e?.code !== "P2002") return false;
  if (!field) return true;
  const target = e.meta?.target;
  return Array.isArray(target) ? target.includes(field) : typeof target === "string" && target.includes(field);
}
