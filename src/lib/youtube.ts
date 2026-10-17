/** Same acceptance rule as the original prototype: youtu.be/ID, youtube.com/watch?v=ID or /embed/ID. */
export function isYouTubeUrl(input: string): boolean {
  return /(youtu\.be\/|youtube\.com\/(watch\?v=|embed\/))[\w-]{6,}/.test(input.trim())
}
