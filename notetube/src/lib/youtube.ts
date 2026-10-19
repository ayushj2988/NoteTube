/** Same acceptance rule the backend uses: youtu.be/ID, youtube.com/watch?v=ID, /embed/, /shorts/, /live/. */
export function extractVideoId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    const host = url.hostname.replace(/^www\.|^m\.|^music\./, '')
    if (host === 'youtu.be') return /^[\w-]{11}$/.test(url.pathname.slice(1, 12)) ? url.pathname.slice(1, 12) : null
    if (host === 'youtube.com') {
      const v = url.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v
      const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)
      if (m) return m[1]
    }
  } catch {
    /* not a URL */
  }
  return null
}

export const isYouTubeUrl = (input: string): boolean => extractVideoId(input) !== null
