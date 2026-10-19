import { keepPreviousData, QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from './client'
import type { CreateNoteInput, Grade, Note, NotesQuery, Settings } from './types'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
})

export const qk = {
  me: ['me'] as const,
  usage: ['usage'] as const,
  settings: ['settings'] as const,
  notes: (q: NotesQuery) => ['notes', q] as const,
  note: (id: string) => ['note', id] as const,
  tags: ['tags'] as const,
  folders: ['folders'] as const,
  cards: (q: object) => ['cards', q] as const,
  decks: ['decks'] as const,
  questions: (noteId: string) => ['questions', noteId] as const,
  attempts: (noteId?: string) => ['attempts', noteId ?? 'all'] as const,
  stats: (days: number) => ['stats', days] as const,
  shared: (token: string) => ['shared', token] as const,
}

const ACTIVE = new Set(['queued', 'processing'])

// ---------- account ----------
export const useUsage = () => useQuery({ queryKey: qk.usage, queryFn: api.usage })
export const useSettings = () => useQuery({ queryKey: qk.settings, queryFn: api.settings, staleTime: 5 * 60_000 })

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => api.updateSettings(patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: qk.settings })
      const prev = qc.getQueryData<Settings>(qk.settings)
      if (prev) qc.setQueryData<Settings>(qk.settings, { ...prev, ...patch })
      return { prev }
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.settings, ctx.prev)
    },
    onSuccess: (data) => qc.setQueryData(qk.settings, data),
  })
}

// ---------- notes ----------
export const useNotes = (q: NotesQuery, enabled = true) =>
  useQuery({ queryKey: qk.notes(q), queryFn: () => api.notes(q), placeholderData: keepPreviousData, enabled })

export const useNote = (id: string | undefined) =>
  useQuery({
    queryKey: qk.note(id ?? ''),
    queryFn: () => api.note(id!),
    enabled: !!id,
    refetchInterval: (query) => (query.state.data && ACTIVE.has(query.state.data.status) ? 2000 : false),
  })

export function useInvalidateNotes() {
  const qc = useQueryClient()
  return () => {
    for (const key of ['notes', 'tags', 'folders', 'decks', 'stats', 'usage'] as const) qc.invalidateQueries({ queryKey: [key] })
  }
}

export function usePreviewVideo() {
  return useMutation({ mutationFn: (url: string) => api.previewVideo(url) })
}

export function useCreateNote() {
  const qc = useQueryClient()
  const invalidate = useInvalidateNotes()
  return useMutation({
    mutationFn: (b: CreateNoteInput) => api.createNote(b),
    onSuccess: (note) => {
      qc.setQueryData(qk.note(note.id), note)
      invalidate()
    },
  })
}

export function useUpdateNote(id: string) {
  const qc = useQueryClient()
  const invalidate = useInvalidateNotes()
  return useMutation({
    mutationFn: (b: Parameters<typeof api.updateNote>[1]) => api.updateNote(id, b),
    onSuccess: (note) => {
      qc.setQueryData(qk.note(id), note)
      invalidate()
    },
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  const invalidate = useInvalidateNotes()
  return useMutation({
    mutationFn: (id: string) => api.deleteNote(id),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: qk.note(id) })
      invalidate()
      qc.invalidateQueries({ queryKey: ['cards'] })
      qc.invalidateQueries({ queryKey: ['attempts'] })
    },
  })
}

export function useRetryNote(id: string) {
  const qc = useQueryClient()
  const invalidate = useInvalidateNotes()
  return useMutation({
    mutationFn: (transcript?: string) => api.retryNote(id, transcript),
    onSuccess: (note: Note) => {
      qc.setQueryData(qk.note(id), note)
      invalidate()
    },
  })
}

export function useShare(id: string) {
  const qc = useQueryClient()
  const set = (patch: Partial<Note>) => qc.setQueryData<Note>(qk.note(id), (n) => (n ? { ...n, ...patch } : n))
  return {
    share: useMutation({ mutationFn: () => api.shareNote(id), onSuccess: ({ token }) => set({ shared: true, share_token: token }) }),
    unshare: useMutation({ mutationFn: () => api.unshareNote(id), onSuccess: () => set({ shared: false, share_token: null }) }),
  }
}

export const useTags = () => useQuery({ queryKey: qk.tags, queryFn: api.tags })
export const useFolders = () => useQuery({ queryKey: qk.folders, queryFn: api.folders })

export function useFolderActions() {
  const qc = useQueryClient()
  const done = () => {
    qc.invalidateQueries({ queryKey: ['folders'] })
    qc.invalidateQueries({ queryKey: ['notes'] })
  }
  return {
    create: useMutation({ mutationFn: (name: string) => api.createFolder(name), onSuccess: done }),
    rename: useMutation({ mutationFn: (v: { id: string; name: string }) => api.renameFolder(v.id, v.name), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => api.deleteFolder(id), onSuccess: done }),
  }
}

// ---------- flashcards ----------
export const useFlashcards = (q: { due?: boolean; note_id?: string; limit?: number; offset?: number }, enabled = true) =>
  useQuery({ queryKey: qk.cards(q), queryFn: () => api.flashcards(q), enabled, placeholderData: keepPreviousData })

export const useDecks = () => useQuery({ queryKey: qk.decks, queryFn: api.decks })

export function useCardActions() {
  const qc = useQueryClient()
  const done = () => {
    qc.invalidateQueries({ queryKey: ['cards'] })
    qc.invalidateQueries({ queryKey: ['decks'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
    qc.invalidateQueries({ queryKey: ['notes'] })
  }
  return {
    create: useMutation({ mutationFn: api.createCard, onSuccess: done }),
    update: useMutation({ mutationFn: (v: { id: string; front?: string; back?: string }) => api.updateCard(v.id, v), onSuccess: done }),
    remove: useMutation({ mutationFn: (id: string) => api.deleteCard(id), onSuccess: done }),
    // reviews are applied one by one during a session; refresh the lists once the session ends
    review: useMutation({ mutationFn: (v: { id: string; grade: Grade }) => api.reviewCard(v.id, v.grade) }),
    refresh: done,
  }
}

// ---------- quizzes ----------
export const useQuizQuestions = (noteId: string) => useQuery({ queryKey: qk.questions(noteId), queryFn: () => api.quizQuestions(noteId), enabled: !!noteId })
export const useQuizAttempts = (q: { note_id?: string; limit?: number } = {}) =>
  useQuery({ queryKey: [...qk.attempts(q.note_id), q.limit ?? 20], queryFn: () => api.quizAttempts(q) })

export function useSubmitAttempt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.submitAttempt,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attempts'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

// ---------- stats + sharing ----------
export const useStats = (days: 7 | 30) => useQuery({ queryKey: qk.stats(days), queryFn: () => api.stats(days) })
export const useSharedNote = (token: string) => useQuery({ queryKey: qk.shared(token), queryFn: () => api.sharedNote(token), retry: false })

/** Recent notes for the notification bell. Polls while anything is still generating. */
export const useRecentActivity = () =>
  useQuery({
    queryKey: qk.notes({ limit: 20, sort: 'recent' }),
    queryFn: () => api.notes({ limit: 20, sort: 'recent' }),
    refetchInterval: (query) => (query.state.data?.items.some((n) => ACTIVE.has(n.status)) ? 4000 : false),
  })

export const useDueCount = () => useFlashcards({ due: true, limit: 1 })
