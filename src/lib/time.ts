/** Campos @db.Time do Prisma trafegam como Date (data fixa 1970-01-01) serializados em ISO. */

export function parseTimeInput(value: string | null | undefined): string | null {
  if (!value) return null;
  return `1970-01-01T${value}:00.000Z`;
}

export function formatTimeValue(value: unknown): string {
  if (!value) return "";
  const iso = typeof value === "string" ? value : (value as Date).toISOString();
  const match = iso.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}
