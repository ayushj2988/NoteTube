import LiquidLayer from './LiquidLayer'

export default function Toast({ message, still }: { message: string | null; still: boolean }) {
  if (!message) return null
  return (
    <div className="toast gl liquid" role="status" aria-live="polite">
      <LiquidLayer radius={20} blur={0.2} displacement={24} still={still} />
      {message}
    </div>
  )
}
