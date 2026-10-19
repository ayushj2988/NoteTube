import type { Context } from "hono";
import { z, ZodError, type ZodTypeAny } from "zod";
import { AppError, validation } from "./errors.js";

export function zodToFields(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const i of err.issues) {
    const key = i.path.join(".") || "body";
    if (!(key in fields)) fields[key] = i.message;
  }
  return fields;
}

export async function parseBody<T extends ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try { raw = await c.req.json(); } catch { throw validation({ body: "Body must be valid JSON." }); }
  const r = schema.safeParse(raw);
  if (!r.success) throw validation(zodToFields(r.error));
  return r.data;
}

/** Like parseBody, but an empty body is treated as {}. */
export async function parseOptionalBody<T extends ZodTypeAny>(c: Context, schema: T): Promise<z.infer<T>> {
  const text = await c.req.text();
  if (!text.trim()) return schema.parse({});
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw validation({ body: "Body must be valid JSON." }); }
  const r = schema.safeParse(raw);
  if (!r.success) throw validation(zodToFields(r.error));
  return r.data;
}

export function parseQuery<T extends ZodTypeAny>(c: Context, schema: T): z.infer<T> {
  const r = schema.safeParse(c.req.query());
  if (!r.success) throw validation(zodToFields(r.error));
  return r.data;
}

export function clientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const xff = c.req.header("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
  }
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  return env?.incoming?.socket?.remoteAddress ?? "unknown";
}

export const uuidParam = (id: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AppError("NOT_FOUND", "Not found");
  return id;
};

export const emptyToNull = (s: string | null | undefined) => (s && s.trim() ? s : null);

/** Raw `db.execute()` rows hand timestamps back as Postgres text ("2026-10-19 10:00:00.5+00"); drizzle's typed selects give Dates. */
export function iso(v: Date | string): string;
export function iso(v: Date | string | null): string | null;
export function iso(v: Date | string | null): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  const fixed = v.replace(" ", "T").replace(/([+-]\d\d)$/, "$1:00");
  return new Date(fixed).toISOString();
}
