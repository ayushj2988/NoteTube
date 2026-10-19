import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { flashcards, notes, quizQuestions, studySessions } from "../src/db/schema.js";
import { applySm2, NEW_CARD, type CardState, type Grade } from "../src/lib/sm2.js";
import { makeHarness, signedIn, type Harness } from "./helpers.js";

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(async () => { await h.close(); });

const DAY = 86_400_000;
const noonUtc = (daysAgo: number) => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() - daysAgo, 12)); };

describe("SM-2 (must match the contract; the frontend uses the same function)", () => {
  it("new card -> good, good, good, easy, hard, again, against hand-computed values", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    // interval uses the PREVIOUS ease; ease changes after every grade: good +0, easy +0.1, hard -0.14, again -0.54
    const expected: { grade: Grade; reps: number; interval: number; ease: number; lapses: number; dueMs: number }[] = [
      { grade: "good", reps: 1, interval: 1, ease: 2.5, lapses: 0, dueMs: DAY },
      { grade: "good", reps: 2, interval: 6, ease: 2.5, lapses: 0, dueMs: 6 * DAY },
      { grade: "good", reps: 3, interval: 15, ease: 2.5, lapses: 0, dueMs: 15 * DAY },            // round(6 * 2.5)
      { grade: "easy", reps: 4, interval: 38, ease: 2.6, lapses: 0, dueMs: 38 * DAY },            // round(15 * 2.5) = round(37.5)
      { grade: "hard", reps: 5, interval: 99, ease: 2.46, lapses: 0, dueMs: 99 * DAY },           // round(38 * 2.6) = round(98.8)
      { grade: "again", reps: 0, interval: 0, ease: 1.92, lapses: 1, dueMs: 10 * 60_000 },        // 10 minutes
    ];
    let s: CardState = { ...NEW_CARD };
    for (const e of expected) {
      const next = applySm2(s, e.grade, now);
      expect(next.reps, e.grade).toBe(e.reps);
      expect(next.intervalDays, e.grade).toBe(e.interval);
      expect(next.ease, e.grade).toBeCloseTo(e.ease, 2);
      expect(next.lapses, e.grade).toBe(e.lapses);
      expect(next.dueAt.getTime() - now.getTime(), e.grade).toBe(e.dueMs);
      s = next;
    }
  });
  it("ease never drops below 1.3", () => {
    let s: CardState = { ...NEW_CARD };
    for (let i = 0; i < 10; i++) s = applySm2(s, "again", new Date());
    expect(s.ease).toBe(1.3);
  });
});

describe("flashcards API", () => {
  it("create, due list, review good/again, decks, edit, delete", async () => {
    const { c, user } = await signedIn(h);
    const [note] = await h.db.insert(notes).values({ userId: user.id, title: "Graphs", status: "ready" }).returning();
    const made = await c.post("/flashcards", { note_id: note!.id, front: "What is BFS?", back: "Breadth-first search." });
    expect(made.status).toBe(201);
    expect(made.json).toMatchObject({ note_title: "Graphs", ease: 2.5, reps: 0, interval_days: 0, lapses: 0, last_reviewed_at: null });

    const due = (await c.get("/flashcards?due=1")).json;
    expect(due).toMatchObject({ total: 1, due_count: 1, next_due_at: null });

    const good = await c.post(`/flashcards/${made.json.id}/review`, { grade: "good" });
    expect(good.json).toMatchObject({ reps: 1, interval_days: 1 });
    expect(new Date(good.json.due_at).getTime() - Date.now()).toBeGreaterThan(DAY - 60_000);
    const after = (await c.get("/flashcards?due=1")).json;
    expect(after).toMatchObject({ total: 0, due_count: 0 });
    expect(after.next_due_at).toBe(good.json.due_at);

    const again = await c.post(`/flashcards/${made.json.id}/review`, { grade: "again" });
    expect(again.json).toMatchObject({ reps: 0, lapses: 1, interval_days: 0 });
    const mins = (new Date(again.json.due_at).getTime() - Date.now()) / 60_000;
    expect(mins).toBeGreaterThan(9); expect(mins).toBeLessThan(10.1);
    expect((await c.post(`/flashcards/${made.json.id}/review`, { grade: "meh" })).status).toBe(422);

    expect((await c.get("/flashcards/decks")).json.items).toEqual([{ note_id: note!.id, note_title: "Graphs", total: 1, due: 0 }]);
    expect((await c.patch(`/flashcards/${made.json.id}`, { back: "Level by level." })).json.back).toBe("Level by level.");
    expect((await c.post("/flashcards", { note_id: note!.id, front: "", back: "x" })).status).toBe(422);
    expect((await c.del(`/flashcards/${made.json.id}`)).status).toBe(204);
    expect((await c.del(`/flashcards/${made.json.id}`)).status).toBe(404);
  });
});

describe("quizzes", () => {
  it("scores on the server, links retries, rejects foreign or duplicate answers", async () => {
    const { c, user } = await signedIn(h);
    const [note] = await h.db.insert(notes).values({ userId: user.id, title: "Quiz note", status: "ready" }).returning();
    const qs = await h.db.insert(quizQuestions).values([0, 1, 2].map((i) => ({ noteId: note!.id, position: i, question: `Q${i}`, options: ["a", "b", "c", "d"], answerIndex: i, explanation: "why" }))).returning();
    const listed = (await c.get(`/quiz/questions?note_id=${note!.id}`)).json.items;
    expect(listed.map((q: any) => q.question)).toEqual(["Q0", "Q1", "Q2"]);
    expect(listed[0]).toMatchObject({ answer_index: 0, explanation: "why", options: ["a", "b", "c", "d"] });

    // the client says nothing about correctness: it only sends what was picked
    const a1 = await c.post("/quiz/attempts", { note_id: note!.id, answers: [{ question_id: qs[0]!.id, picked: 0 }, { question_id: qs[1]!.id, picked: 3 }, { question_id: qs[2]!.id, picked: 2 }] });
    expect(a1.status).toBe(201);
    expect(a1.json).toMatchObject({ score: 2, total: 3, retry_of: null, note_title: "Quiz note" });
    expect(a1.json.answers).toEqual([
      { question_id: qs[0]!.id, picked: 0, correct: true }, { question_id: qs[1]!.id, picked: 3, correct: false }, { question_id: qs[2]!.id, picked: 2, correct: true },
    ]);
    const a2 = await c.post("/quiz/attempts", { note_id: note!.id, retry_of: a1.json.id, answers: qs.map((q, i) => ({ question_id: q.id, picked: i })) });
    expect(a2.json).toMatchObject({ score: 3, total: 3, retry_of: a1.json.id });
    expect((await c.post("/quiz/attempts", { note_id: note!.id, retry_of: "00000000-0000-4000-8000-000000000000", answers: [{ question_id: qs[0]!.id, picked: 0 }] })).status).toBe(422);
    expect((await c.post("/quiz/attempts", { note_id: note!.id, answers: [{ question_id: qs[0]!.id, picked: 0 }, { question_id: qs[0]!.id, picked: 1 }] })).status).toBe(422);
    expect((await c.post("/quiz/attempts", { note_id: note!.id, answers: [{ question_id: "00000000-0000-4000-8000-000000000000", picked: 0 }] })).status).toBe(422);
    expect((await c.post("/quiz/attempts", { note_id: note!.id, answers: [{ question_id: qs[0]!.id, picked: 9 }] })).status).toBe(422);

    const hist = (await c.get(`/quiz/attempts?note_id=${note!.id}`)).json.items;
    expect(hist.map((a: any) => a.id)).toEqual([a2.json.id, a1.json.id]); // newest first
  });
});

describe("study time and stats", () => {
  it("empty account: exact shape, zero-filled days, null quiz_average", async () => {
    const { c } = await signedIn(h);
    const s = (await c.get("/stats/summary?days=7&tz=Asia/Calcutta")).json;
    expect(Object.keys(s).sort()).toEqual(["cards_due", "cards_total", "days", "minutes_total", "mastery", "notes_total", "quiz_attempts", "quiz_average", "streak_days"].sort());
    expect(s.days).toHaveLength(7);
    expect(s.days.every((d: any) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.minutes === 0)).toBe(true);
    expect([...s.days].sort((a: any, b: any) => a.date.localeCompare(b.date))).toEqual(s.days); // oldest first
    expect(s).toMatchObject({ minutes_total: 0, cards_due: 0, cards_total: 0, notes_total: 0, quiz_average: null, quiz_attempts: 0, streak_days: 0, mastery: [] });
    expect((await c.get("/stats/summary?days=30")).json.days).toHaveLength(30);
    expect((await c.get("/stats/summary?days=5")).status).toBe(422);
    expect((await c.get("/stats/summary?tz=Not/AZone")).status).toBe(422);
  });

  it("streak counts consecutive days, survives an empty today, and stops at a gap", async () => {
    const { c, user } = await signedIn(h);
    for (const ago of [1, 2, 4]) await h.db.insert(studySessions).values({ userId: user.id, kind: "reading", seconds: 600, createdAt: noonUtc(ago) });
    expect((await c.get("/stats/summary")).json.streak_days).toBe(2); // yesterday + the day before; today still empty; gap before day -4
    const r = await c.post("/sessions", { kind: "reading", seconds: 5000 }); // clamped to 3600
    expect(r.status).toBe(204);
    const s = (await c.get("/stats/summary?days=7")).json;
    expect(s.streak_days).toBe(3); // today joins the run
    expect(s.days.at(-1).minutes).toBe(60);
    expect(s.days.at(-2).minutes).toBe(10);
    expect(s.minutes_total).toBe(60 + 10 + 10 + 10);
  });

  it("ignores study time above 12 h per day", async () => {
    const { c } = await signedIn(h);
    for (let i = 0; i < 14; i++) expect((await c.post("/sessions", { kind: "quiz", seconds: 3600 })).status).toBe(204);
    expect((await c.get("/stats/summary")).json.days.at(-1).minutes).toBe(720);
    expect((await c.post("/sessions", { kind: "nap", seconds: 5 })).status).toBe(422);
  });

  it("quiz average, card strength and mastery", async () => {
    const { c, user } = await signedIn(h);
    const [n1] = await h.db.insert(notes).values({ userId: user.id, title: "A", status: "ready", subject: "Algorithms" }).returning();
    await h.db.insert(notes).values({ userId: user.id, title: "B", status: "ready", subject: "Empty subject" });
    await h.db.insert(flashcards).values([
      { userId: user.id, noteId: n1!.id, front: "1", back: "1", intervalDays: 6 }, { userId: user.id, noteId: n1!.id, front: "2", back: "2", intervalDays: 0 },
    ]);
    const qs = await h.db.insert(quizQuestions).values([0, 1, 2].map((i) => ({ noteId: n1!.id, position: i, question: `Q${i}`, options: ["a", "b", "c", "d"], answerIndex: 0 }))).returning();
    const ans = (picks: number[]) => qs.map((q, i) => ({ question_id: q.id, picked: picks[i]! }));
    await c.post("/quiz/attempts", { note_id: n1!.id, answers: ans([0, 0, 1]) }); // 2/3
    await c.post("/quiz/attempts", { note_id: n1!.id, answers: ans([0, 0, 0]) }); // 3/3
    const s = (await c.get("/stats/summary")).json;
    expect(s).toMatchObject({ quiz_attempts: 2, quiz_average: 83, cards_total: 2, cards_due: 2, notes_total: 2 });
    expect(s.mastery).toEqual([{ subject: "Algorithms", percent: 67, cards: 2 }]); // (50% card strength + 83% quiz) / 2; subject with neither is omitted
  });
});
