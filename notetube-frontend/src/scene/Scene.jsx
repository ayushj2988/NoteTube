import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import Particles from './Particles.jsx'

// One fixed canvas behind the whole app. It pauses when the tab is hidden and stays still for "reduce motion".
export default function Scene() {
  const [visible, setVisible] = useState(!document.hidden)
  const [reduced, setReduced] = useState(matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const vis = () => setVisible(!document.hidden)
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const rm = () => setReduced(mq.matches)
    document.addEventListener('visibilitychange', vis)
    mq.addEventListener('change', rm)
    return () => {
      document.removeEventListener('visibilitychange', vis)
      mq.removeEventListener('change', rm)
    }
  }, [])
  return (
    <div id="gl" aria-hidden="true">
      <Canvas dpr={[1, 2]} frameloop={visible ? 'always' : 'never'} camera={{ position: [0, 0, 6], fov: 40, near: 0.1, far: 50 }} gl={{ antialias: true, alpha: true }}>
        <Particles reduced={reduced} />
      </Canvas>
    </div>
  )
}
