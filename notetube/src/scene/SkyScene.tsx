import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { skyState } from './skyState'

/* ------------------------------------------------------------------ */
/* Cloud banks: every puff is one instance of a billboarded quad.       */
/* Drift is computed in the vertex shader, so JS does no per-puff work. */
/* ------------------------------------------------------------------ */
const vert = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iColor;   // rgb + opacity
attribute vec3 iParams;  // scale, phase, speed
uniform float uTime;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vUv = uv;
  vColor = iColor;
  vec3 p = iPos;
  p.x += sin(uTime * iParams.z + iParams.y) * 0.5;
  p.y += cos(uTime * iParams.z * 0.8 + iParams.y) * 0.25;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.xy += position.xy * iParams.x;
  gl_Position = projectionMatrix * mv;
}
`

/** Same radial falloff as the prototype's canvas sprite: alpha 1 -> .55 at 45% -> 0 at the edge. */
const frag = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = d < 0.45 ? mix(1.0, 0.55, d / 0.45) : mix(0.55, 0.0, (d - 0.45) / 0.55);
  a = d >= 1.0 ? 0.0 : a;
  gl_FragColor = vec4(vColor.rgb, vColor.a * a);
}
`

const PUFFS_PER_SIDE = 75
const WHITE = new THREE.Color(0xffffff)
const BLUE = new THREE.Color(0x9cc8f7)

function buildClouds(): THREE.InstancedBufferGeometry {
  type Puff = { x: number; y: number; z: number; color: THREE.Color; opacity: number; scale: number; phase: number; speed: number }
  const puffs: Puff[] = []
  // two banks flanking the headline, piling up toward the bottom
  for (const side of [-1, 1]) {
    for (let i = 0; i < PUFFS_PER_SIDE; i++) {
      const y = -8 + Math.pow(Math.random(), 1.25) * 14.5
      const low = y < -3
      const x = side * ((low ? 1.5 : 5.2) + Math.random() * (low ? 10 : 8.5))
      const z = -7 + Math.random() * 7
      const tint = Math.min(1, Math.max(0, (-y + z * -0.3) / 9))
      puffs.push({
        x, y, z,
        color: WHITE.clone().lerp(BLUE, tint * 0.75),
        opacity: 0.28 + Math.random() * 0.42,
        scale: 3 + Math.random() * 4.5,
        phase: Math.random() * 9,
        speed: 0.05 + Math.random() * 0.1,
      })
    }
  }
  // far puffs first: normal alpha blending needs back-to-front order
  puffs.sort((a, b) => a.z - b.z)

  const n = puffs.length
  const pos = new Float32Array(n * 3)
  const col = new Float32Array(n * 4)
  const par = new Float32Array(n * 3)
  puffs.forEach((p, i) => {
    pos.set([p.x, p.y, p.z], i * 3)
    col.set([p.color.r, p.color.g, p.color.b, p.opacity], i * 4)
    par.set([p.scale, p.phase, p.speed], i * 3)
  })

  const quad = new THREE.PlaneGeometry(1, 1)
  const g = new THREE.InstancedBufferGeometry()
  g.index = quad.index
  g.setAttribute('position', quad.getAttribute('position'))
  g.setAttribute('uv', quad.getAttribute('uv'))
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3))
  g.setAttribute('iColor', new THREE.InstancedBufferAttribute(col, 4))
  g.setAttribute('iParams', new THREE.InstancedBufferAttribute(par, 3))
  g.instanceCount = n
  return g
}

function Clouds({ uTime }: { uTime: THREE.IUniform<number> }) {
  const geometry = useMemo(buildClouds, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={{ uTime }}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Driver: pointer parallax, reader "mood" dolly, card parallax        */
/* ------------------------------------------------------------------ */
function Driver({ uTime, reduced }: { uTime: THREE.IUniform<number>; reduced: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  const target = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    // with motion off the loop is on demand, so redraw when the mood changes
    skyState.onMood = reduced ? invalidate : null
    return () => {
      skyState.onMood = null
    }
  }, [reduced, invalidate])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const { pointer, mood } = skyState
    // same easing as the prototype (0.05 / 0.04 per 60 fps frame), made frame-rate independent
    const kp = reduced ? 0 : 1 - Math.exp(-dt * 3.1)
    const km = reduced ? 1 : 1 - Math.exp(-dt * 2.45)
    pointer.sx += (pointer.x - pointer.sx) * kp
    pointer.sy += (pointer.y - pointer.sy) * kp
    mood.v += (mood.t - mood.v) * km

    state.camera.position.set(pointer.sx * 1.2, pointer.sy * 0.6, 12 - mood.v * 1.4)
    state.camera.lookAt(target)
    if (!reduced) uTime.value += dt
    if (skyState.parallaxEl && !reduced) {
      skyState.parallaxEl.style.transform = `translate(${pointer.sx * -8}px, ${pointer.sy * 5}px)`
    }
  })
  return null
}

class SceneBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFail()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function SkyScene({ reduced }: { reduced: boolean }) {
  const [dpr, setDpr] = useState(1.25)
  const [failed, setFailed] = useState(false)
  const uTime = useMemo<THREE.IUniform<number>>(() => ({ value: 0 }), [])

  // the canvas is pointer-events: none, so track the pointer on window
  useEffect(() => {
    if (reduced) {
      skyState.pointer.x = skyState.pointer.y = 0
      return
    }
    const onMove = (e: PointerEvent) => {
      skyState.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      skyState.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [reduced])

  // clear any inline parallax when motion is switched off
  useEffect(() => {
    if (reduced && skyState.parallaxEl) skyState.parallaxEl.style.transform = ''
  }, [reduced])

  if (failed) return null
  return (
    <div className="sky" aria-hidden="true">
      <SceneBoundary onFail={() => setFailed(true)}>
        <Canvas
          dpr={dpr}
          frameloop={reduced ? 'demand' : 'always'}
          camera={{ position: [0, 0, 12], fov: 45, near: 0.1, far: 100 }}
          gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
          flat
        >
          <PerformanceMonitor
            flipflops={3}
            onChange={({ factor }) => setDpr(Math.round((0.75 + 0.75 * factor) * 20) / 20)}
          />
          <Driver uTime={uTime} reduced={reduced} />
          <Clouds uTime={uTime} />
        </Canvas>
      </SceneBoundary>
    </div>
  )
}
