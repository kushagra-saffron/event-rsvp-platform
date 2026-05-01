/**
 * Postgres functions that return JSONB occasionally surface as serialized JSON strings
 * depending on PostgREST / client version. Normalize to a plain object.
 */
export function coerceRpcJsonb<T extends object>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === "object" && parsed !== null) return parsed as T;
      return null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && raw !== null) return raw as T;
  return null;
}
