import { useLayoutEffect, useRef, useState } from 'react'
import LiquidGlass from 'liquid-glass-react'
import { useMotion } from '../ui/motion'

/** Constant pointer values: passing both props makes liquid-glass-react skip its own mousemove listeners. */
const STILL_POS = { x: 0, y: 0 }
const STILL_OFFSET = { x: 0, y: 0 }

interface Props {
  radius?: number
  /** backdrop blur strength, in the library's own units */
  blur?: number
  displacement?: number
  /** override the reduced-motion setting (defaults to the app-wide value) */
  still?: boolean
}

/**
 * A refracting glass layer that fills its (relatively positioned) parent.
 * liquid-glass-react sizes itself from its children and centres itself in a wrapper, so this
 * measures the parent and gives the library an empty child of exactly that size. Real content
 * stays in normal flow above the layer.
 */
export default function LiquidLayer({ radius = 20, blur = 0.25, displacement = 36, still }: Props) {
  const { reduced } = useMotion()
  const calm = still ?? reduced
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const w = Math.round(width)
      const h = Math.round(height)
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} className="liquid-layer" aria-hidden="true">
      {size && size.w > 0 && size.h > 0 && (
        <LiquidGlass
          style={{ position: 'absolute', top: '50%', left: '50%' }}
          cornerRadius={radius}
          padding="0"
          elasticity={0}
          blurAmount={blur}
          saturation={150}
          displacementScale={calm ? 0 : displacement}
          aberrationIntensity={calm ? 0 : 1.5}
          globalMousePos={STILL_POS}
          mouseOffset={STILL_OFFSET}
        >
          <div style={{ width: size.w, height: size.h }} />
        </LiquidGlass>
      )}
    </div>
  )
}
