import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { requireAuth } from "../middleware.js";
import type { Ctx, Env } from "../types.js";

export function tagRoutes(ctx: Ctx) {
  const r = new Hono<Env>();
  r.use("*", requireAuth(ctx));
  r.get("/", async (c) => {
    const res = await ctx.db.execute(sql`SELECT tag, count(*)::int AS count FROM notes, unnest(tags) AS tag
      WHERE user_id = ${c.get("user").id} GROUP BY tag ORDER BY count DESC, tag`);
    return c.json({ items: res.rows });
  });
  return r;
}
