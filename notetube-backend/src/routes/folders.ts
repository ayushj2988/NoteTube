import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { folders } from "../db/schema.js";
import { notFound, pgCode, validation } from "../lib/errors.js";
import { parseBody, uuidParam } from "../lib/http.js";
import { stripHtml } from "../lib/sanitize.js";
import { requireAuth } from "../middleware.js";
import type { Ctx, Env } from "../types.js";

const Name = z.object({ name: z.string().trim().min(1, "Give the folder a name.").max(40, "Use at most 40 characters.") });

export function folderRoutes(ctx: Ctx) {
  const r = new Hono<Env>();
  const { db } = ctx;
  r.use("*", requireAuth(ctx));

  const json = (f: { id: string; name: string }, n: number) => ({ id: f.id, name: f.name, note_count: n });
  const dup = (e: unknown) => {
    if (pgCode(e) === "23505") throw validation({ name: "You already have a folder with that name." });
    throw e;
  };

  r.get("/", async (c) => {
    const res = await db.execute(sql`SELECT f.id, f.name, (SELECT count(*)::int FROM notes n WHERE n.folder_id = f.id) AS note_count
      FROM folders f WHERE f.user_id = ${c.get("user").id} ORDER BY lower(f.name)`);
    return c.json({ items: (res.rows as { id: string; name: string; note_count: number }[]).map((f) => json(f, f.note_count)) });
  });

  r.post("/", async (c) => {
    const { name } = await parseBody(c, Name);
    try {
      const [f] = await db.insert(folders).values({ userId: c.get("user").id, name: stripHtml(name) }).returning();
      return c.json(json(f!, 0), 201);
    } catch (e) { return dup(e); }
  });

  r.patch("/:id", async (c) => {
    const { name } = await parseBody(c, Name);
    const id = uuidParam(c.req.param("id")), uid = c.get("user").id;
    try {
      const [f] = await db.update(folders).set({ name: stripHtml(name) }).where(and(eq(folders.id, id), eq(folders.userId, uid))).returning();
      if (!f) throw notFound();
      const res = await db.execute(sql`SELECT count(*)::int AS n FROM notes WHERE folder_id = ${id}`);
      return c.json(json(f, (res.rows[0] as { n: number }).n));
    } catch (e) { return dup(e); }
  });

  r.delete("/:id", async (c) => {
    const res = await db.delete(folders).where(and(eq(folders.id, uuidParam(c.req.param("id"))), eq(folders.userId, c.get("user").id))).returning({ id: folders.id });
    if (!res.length) throw notFound();
    return c.body(null, 204); // notes become unfiled (FK is ON DELETE SET NULL)
  });
  return r;
}
