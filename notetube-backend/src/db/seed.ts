import { eq } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { createDb } from "./index.js";
import { flashcards, generationLog, notes, quizQuestions, settings, users } from "./schema.js";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV=production.");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const { db, pool } = createDb(url);
const EMAIL = "demo@example.com";

const [existing] = await db.select().from(users).where(eq(users.email, EMAIL));
if (existing) {
  console.log(`Demo user already exists (${EMAIL}). Nothing to do.`);
  await pool.end();
  process.exit(0);
}

const [user] = await db.insert(users).values({ name: "Demo Student", email: EMAIL, passwordHash: await hash("demo-password-123") }).returning();
await db.insert(settings).values({ userId: user!.id });

const demo = [
  {
    title: "Graph Traversal: BFS & DFS", subject: "Algorithms", tags: ["graphs", "cs"], videoId: "dsa-graphs1",
    summary: "How breadth-first and depth-first search explore a graph, and when to use each.",
    keyConcepts: ["Node", "Edge", "Queue", "Stack", "Visited set"],
    skim: ["Graphs are nodes plus edges.", "BFS uses a queue and finds shortest unweighted paths.", "DFS uses a stack or recursion.", "Both run in O(V + E).", "Track visited nodes to avoid cycles."],
    md: "## [03:12] Graphs\n- A graph is a set of nodes connected by edges.\n\n## [11:40] BFS\n- Explores level by level using a queue.\n- Finds shortest paths in unweighted graphs.\n\n## [24:05] DFS\n- Dives deep first, using recursion or an explicit stack.\n\n**Takeaway:** pick BFS for shortest paths, DFS for exploring structure.",
    cards: [["What data structure drives BFS?", "A queue (FIFO)."], ["What drives DFS?", "A stack, or recursion."], ["Time complexity of BFS?", "O(V + E)."]],
    quiz: [["Which finds shortest paths on an unweighted graph?", ["DFS", "BFS", "Topological sort", "Prim's"], 1], ["What holds BFS's frontier?", ["Stack", "Heap", "Queue", "Set"], 2]],
  },
  {
    title: "Process Scheduling in OS", subject: "Operating Systems", tags: ["os"], videoId: "os-sched01",
    summary: "FCFS, SJF and round-robin scheduling compared.",
    keyConcepts: ["Context switch", "Time quantum", "Starvation"],
    skim: ["Scheduling picks the next process to run.", "FCFS is simple but can convoy.", "SJF minimises average wait.", "Round robin uses a time quantum.", "Starvation needs aging."],
    md: "## [02:10] FCFS\n- First come, first served.\n\n## [15:30] Round robin\n- Each process gets a fixed time quantum.\n\n**Takeaway:** round robin trades throughput for fairness.",
    cards: [["What is a context switch?", "Saving one process's state and loading another's."], ["What is starvation?", "A process that never gets CPU time."]],
    quiz: [["Round robin relies on a fixed...", ["Priority", "Time quantum", "Deadline", "Stack"], 1]],
  },
];

for (const d of demo) {
  const [n] = await db.insert(notes).values({
    userId: user!.id, title: d.title, subject: d.subject, tags: d.tags, status: "ready", progressStep: 4, summary: d.summary,
    keyConcepts: d.keyConcepts, skim: d.skim, contentMd: d.md, style: "detailed", language: "en",
    youtubeId: d.videoId, videoTitle: d.title, videoChannel: "Demo Lectures", videoDuration: 2880, videoThumbnail: `https://i.ytimg.com/vi/${d.videoId}/hqdefault.jpg`,
  }).returning();
  await db.insert(flashcards).values(d.cards.map(([front, back]) => ({ userId: user!.id, noteId: n!.id, front: front!, back: back! })));
  await db.insert(quizQuestions).values(d.quiz.map(([question, options, answer], i) => ({ noteId: n!.id, position: i, question: question as string, options: options as string[], answerIndex: answer as number, explanation: "" })));
  await db.insert(generationLog).values({ userId: user!.id, noteId: n!.id });
}
console.log(`Seeded ${EMAIL} / demo-password-123 with ${demo.length} notes.`);
await pool.end();
