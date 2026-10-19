import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { generationLog } from "../db/schema.js";
import { AppError } from "../lib/errors.js";

export const utcDayStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
export const nextReset = (now = new Date()) => new Date(utcDayStart(now).getTime() + 86_400_000);

type Q = Pick<Db, "select">;

export async function getUsage(db: Q, userId: string, limit: number) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(generationLog)
    .where(and(eq(generationLog.userId, userId), gte(generationLog.createdAt, utcDayStart()), eq(generationLog.refunded, false)));
  return { used: row?.n ?? 0, limit, resets_at: nextReset().toISOString() };
}

export async function assertQuota(db: Q, userId: string, limit: number) {
  const u = await getUsage(db, userId, limit);
  if (u.used >= limit) throw new AppError("QUOTA_EXCEEDED", "You've reached today's generation limit.", { ...u });
}
