export type View = 'home' | 'library' | 'flashcards' | 'quizzes' | 'progress' | 'settings' | 'new' | 'read'
export type ReaderTab = 'full' | 'skim' | 'cards' | 'quiz'

export interface Note {
  title: string
  duration: string
  meta: string
  tag: string
  color: string
}

export const NOTES: Note[] = [
  { title: 'Graph Traversal: BFS & DFS', duration: '48:12', meta: 'Today · 18 notes', tag: 'Algorithms', color: '#2a6cd0' },
  { title: 'Convolutional Layers, Explained', duration: '32:40', meta: 'Yesterday · 12 notes', tag: 'Machine Learning', color: '#1c58b0' },
  { title: 'Process Scheduling in OS', duration: '1:05:03', meta: 'Mon · 24 notes', tag: 'Operating Systems', color: '#10264a' },
  { title: 'B-Trees and Indexing', duration: '41:20', meta: 'Sun · 15 notes', tag: 'Databases', color: '#3f84e6' },
  { title: 'Gradient Descent Intuition', duration: '27:55', meta: 'Fri · 9 notes', tag: 'Machine Learning', color: '#5a9bf0' },
  { title: 'TCP Handshake & Congestion', duration: '36:08', meta: 'Thu · 14 notes', tag: 'Networks', color: '#2a6cd0' },
]

/** Clickable timestamps for the sample lecture (48:12 = 2892 s). */
export const TIMESTAMPS: [string, string][] = [
  ['03:12', 'Graphs model relationships as nodes and edges.'],
  ['11:40', 'BFS explores level by level using a queue.'],
  ['24:05', 'DFS dives deep first using recursion or a stack.'],
  ['38:30', 'Pick BFS for shortest paths on unweighted graphs.'],
]
export const LECTURE_SECONDS = 2892
export const KEY_CONCEPTS = ['Node', 'Edge', 'Queue', 'Stack', 'Visited set']

export interface Deck { name: string; cards: [string, string][] }
export const DECKS: Deck[] = [
  { name: 'Graphs', cards: [['What data structure drives BFS?', 'A queue (FIFO).'], ['What drives DFS?', 'A stack or recursion.'], ['BFS time complexity?', 'O(V + E).']] },
  { name: 'Machine Learning', cards: [['What does a convolution layer detect?', 'Local patterns such as edges.'], ['Why use pooling?', 'Shrinks maps and adds tolerance to shifts.'], ['What does a learning rate control?', 'The size of each update step.']] },
  { name: 'OS', cards: [['What is a context switch?', 'Saving one process state and loading another.'], ['Round robin uses what?', 'A fixed time quantum per process.'], ['What is starvation?', 'A process never getting CPU time.']] },
]

export interface Question { q: string; options: string[]; answer: number }
export const QUESTIONS: Question[] = [
  { q: 'Which gives shortest paths on an unweighted graph?', options: ['DFS', 'BFS', 'Topological sort'], answer: 1 },
  { q: 'What does BFS use to hold the frontier?', options: ['Stack', 'Heap', 'Queue'], answer: 2 },
  { q: 'BFS time complexity is?', options: ['O(V + E)', 'O(V²)', 'O(log V)'], answer: 0 },
]

export const WEEK_BARS: { x: number; y: number; h: number; dark?: boolean }[] = [
  { x: 8, y: 40, h: 50 }, { x: 38, y: 25, h: 65 }, { x: 68, y: 50, h: 40 }, { x: 98, y: 15, h: 75, dark: true },
  { x: 128, y: 30, h: 60 }, { x: 158, y: 55, h: 35 }, { x: 188, y: 35, h: 55 },
]
export const MASTERY = [
  { name: 'Algorithms', v: 82 }, { name: 'Machine Learning', v: 64 }, { name: 'Operating Systems', v: 71 }, { name: 'Databases', v: 48 },
]
export const NOTIFICATIONS = [
  { t: 'Flashcards due', s: '84 cards are ready for review.' },
  { t: 'Notes ready', s: 'Process Scheduling in OS finished generating.' },
  { t: 'Streak', s: 'You are on a 12 day study streak.' },
]
