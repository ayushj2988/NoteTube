import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { flashcards, notes, quizQuestions } from "../src/db/schema.js";
import { Client, makeHarness, signedIn, type Harness } from "./helpers.js";

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(async () => { await h.close(); });

describe("user B can never see or change user A's data (always 404, never 403)", () => {
  it("covers notes, folders, flashcards, quiz attempts and sharing", async () => {
    const A = await signedIn(h, "A"), B = await signedIn(h, "B");
    const [note] = await h.db.insert(notes).values({ userId: A.user.id, title: "A's note", status: "ready" }).returning();
    const [card] = await h.db.insert(flashcards).values({ userId: A.user.id, noteId: note!.id, front: "f", back: "b" }).returning();
    const [q] = await h.db.insert(quizQuestions).values({ noteId: note!.id, position: 0, question: "q", options: ["a", "b", "c", "d"], answerIndex: 0 }).returning();
    const folder = (await A.c.post("/folders", { name: "Private" })).json;
    const attempt = (await A.c.post("/quiz/attempts", { note_id: note!.id, answers: [{ question_id: q!.id, picked: 0 }] })).json;
    const share = (await A.c.post(`/notes/${note!.id}/share`)).json;
    expect(attempt.id).toBeTruthy();

    const b = B.c;
    const nf = async (r: Promise<{ status: number; json: any }>) => { const x = await r; expect([x.status, x.json?.error?.code]).toEqual([404, "NOT_FOUND"]); };
    await nf(b.get(`/notes/${note!.id}`));
    await nf(b.patch(`/notes/${note!.id}`, { title: "hacked" }));
    await nf(b.del(`/notes/${note!.id}`));
    await nf(b.post(`/notes/${note!.id}/retry`));
    await nf(b.post(`/notes/${note!.id}/share`));
    await nf(b.del(`/notes/${note!.id}/share`));
    await nf(b.patch(`/folders/${folder.id}`, { name: "mine now" }));
    await nf(b.del(`/folders/${folder.id}`));
    await nf(b.patch(`/flashcards/${card!.id}`, { front: "x" }));
    await nf(b.del(`/flashcards/${card!.id}`));
    await nf(b.post(`/flashcards/${card!.id}/review`, { grade: "good" }));
    await nf(b.post("/flashcards", { note_id: note!.id, front: "x", back: "y" }));
    await nf(b.get(`/quiz/questions?note_id=${note!.id}`));
    await nf(b.post("/quiz/attempts", { note_id: note!.id, answers: [{ question_id: q!.id, picked: 0 }] }));
    await nf(b.post("/sessions", { kind: "reading", seconds: 30, note_id: note!.id }));
    await nf(b.get("/notes/not-a-uuid"));

    // lists never leak
    expect((await b.get("/notes")).json.total).toBe(0);
    expect((await b.get("/flashcards")).json.total).toBe(0);
    expect((await b.get("/folders")).json.items).toEqual([]);
    expect((await b.get("/quiz/attempts")).json.items).toEqual([]);
    expect((await b.get("/tags")).json.items).toEqual([]);
    // B cannot file its own note into A's folder
    const mine = (await h.db.insert(notes).values({ userId: B.user.id, title: "B note", status: "ready" }).returning())[0]!;
    expect((await b.patch(`/notes/${mine.id}`, { folder_id: folder.id })).status).toBe(422);

    // A's data is untouched, and the public share link still works for everyone
    expect((await A.c.get(`/notes/${note!.id}`)).json.title).toBe("A's note");
    expect((await new Client(h.app).get(`/share/${share.token}`)).status).toBe(200);
  });
});
