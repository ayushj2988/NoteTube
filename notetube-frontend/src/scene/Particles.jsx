import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { makeFormations } from './formations.js'
import { useScene } from './SceneContext.jsx'

const CAMERA_Z = 6
const HALF_H = Math.tan((20 * Math.PI) / 180) * CAMERA_Z   // half the visible height at the middle of the scene

const VERT = /* glsl */ `
attribute vec3 aB; attribute vec3 aC; attribute vec2 aR;
uniform float uT; uniform float uK1; uniform float uK2; uniform float uPix; uniform float uPush; uniform vec3 uM;
varying float vHi;
float sm(float x){ x = clamp(x, 0., 1.); return x * x * (3. - 2. * x); }
void main(){
  float s = aR.x;
  vec3 a = position + vec3(sin(uT*.3+s*40.), cos(uT*.25+s*30.), sin(uT*.2+s*20.)) * .35;   // loose cloud
  float k1 = sm((uK1 - s*.4) / .6);
  float k2 = sm((uK2 - s*.4) / .6);
  vec3 p = mix(a, aB, k1);
  p = mix(p, aC, k2);
  p.xy += vec2(sin(uT*1.3+s*50.), cos(uT*1.1+s*60.)) * .012 * (k1 + k2);
  vec4 w = modelMatrix * vec4(p, 1.);
  vec2 d = w.xy - uM.xy; float dist = length(d);
  w.xy += d / (dist + .001) * smoothstep(1.3, 0., dist) * uPush;
  vec4 mv = viewMatrix * w;
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uPix * (1. + s*1.1) / -mv.z;
  vHi = aR.y * k1 * (1. - k2);
}`
const FRAG = /* glsl */ `
uniform vec3 uC; uniform vec3 uH; uniform float uA; varying float vHi;
void main(){
  float d = length(gl_PointCoord - .5);
  if (d > .5) discard;
  gl_FragColor = vec4(mix(uC, uH, vHi), (1. - smoothstep(.3, .5, d)) * uA);
}`

const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x) }
// The landing hero loop (15 s): loose dots, then notes, then flashcards, then back. Returns 0 to 2.
const cycle = (t) => {
  const c = t % 15
  if (c < 1.5) return 0
  if (c < 4) return ease((c - 1.5) / 2.5)
  if (c < 7) return 1
  if (c < 9.5) return 1 + ease((c - 7) / 2.5)
  if (c < 12.5) return 2
  return 2 - 2 * ease((c - 12.5) / 2.5)
}

// The dots: one cloud of 4,200 points drawn by a small shader. JavaScript only sets a few numbers each frame.
// On the landing page they live inside the hero frame. On app pages they are a dim cloud behind everything,
// and they gather into the notes sheet / card fan while a lecture or its flashcards and quiz are being made.
export default function Particles({ reduced }) {
  const group = useRef()
  const scene = useScene()
  const { size } = useThree()
  const { A, B, C, R } = useMemo(() => makeFormations(), [])

  const uniforms = useMemo(
    () => ({
      uT: { value: 0 }, uK1: { value: 0 }, uK2: { value: 0 }, uPix: { value: 14 }, uPush: { value: 0.4 }, uA: { value: 0.3 },
      uM: { value: new THREE.Vector3(99, 99, 0) }, uC: { value: new THREE.Color('#111111') }, uH: { value: new THREE.Color('#f5a400') },
    }),
    [],
  )
  // built once by hand so the uniform objects above are exactly the ones the GPU reads
  const material = useMemo(
    () => new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false }),
    [uniforms],
  )
  const live = useRef({ k1: 0, k2: 0, alpha: 0.3, push: 0, mx: 0, my: 0, sx: 0, sy: 0, pointer: false, gx: 0, gy: 0, gs: 1 })

  useEffect(() => {
    const move = (e) => {
      live.current.mx = (e.clientX / innerWidth) * 2 - 1
      live.current.my = -((e.clientY / innerHeight) * 2 - 1)
      live.current.pointer = true
    }
    const leave = () => { live.current.pointer = false }
    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
    }
  }, [])

  useFrame((state, delta) => {
    const L = live.current
    const now = performance.now()
    const dt = Math.min(delta, 0.1)
    const f = (perFrameAt60) => 1 - Math.pow(1 - perFrameAt60, dt * 60)   // frame-rate independent easing
    const S = scene.state
    const W = size.width
    const H = size.height
    const aspect = W / H
    const halfH = HALF_H
    const halfW = halfH * aspect
    const ppu = H / (2 * halfH)   // screen pixels per scene unit

    let on = false
    let tx = 0
    let ty = 0
    let ts = 1
    let t1 = 0
    let t2 = 0
    let alpha = 0.28

    if (S.view === 'home' && S.stageEl) {
      const sr = S.stageEl.getBoundingClientRect()
      on = sr.bottom > H * 0.15 && sr.top < H * 0.85
      if (on) {
        const hh = sr.height - 40
        tx = (sr.left + sr.width / 2 - W / 2) / ppu
        ty = -(sr.top + 40 + hh / 2 - H / 2) / ppu
        ts = Math.min(hh / (4.4 * ppu), sr.width / (3.8 * ppu))
        const P = reduced ? 1 : cycle(state.clock.elapsedTime)
        t1 = Math.min(P, 1)
        t2 = Math.max(0, P - 1)
        alpha = 0.95
      }
    } else {
      let shape = true
      if (S.extra !== null) { t1 = 1; t2 = S.extra }
      else if (S.view === 'processing') { t1 = S.procP; t2 = S.procQ }
      else if (S.view === 'flashcards' || S.view === 'quiz') { t1 = 0; t2 = 1 }   // straight to cards, never through the sheet
      else shape = false
      if (shape) {
        tx = aspect > 1.15 ? halfW * 0.5 : 0
        ts = Math.min(1, halfW / 1.6)
        alpha = 0.55
      }
    }
    if (S.pulseUntil > now) t1 = Math.max(t1, 1)

    L.k1 += (t1 - L.k1) * f(0.07)
    L.k2 += (t2 - L.k2) * f(0.07)
    L.alpha += (alpha - L.alpha) * f(0.06)
    L.gx += (tx - L.gx) * f(0.08)
    L.gy += (ty - L.gy) * f(0.08)
    L.gs += (ts - L.gs) * f(0.08)
    group.current.position.set(L.gx, L.gy, 0)
    group.current.scale.setScalar(L.gs)

    uniforms.uK1.value = L.k1
    uniforms.uK2.value = L.k2
    uniforms.uA.value = L.alpha
    uniforms.uT.value = reduced ? 0 : state.clock.elapsedTime

    // cursor: push dots away, only while the cursor is over the hero frame or on app pages
    L.sx += (L.mx - L.sx) * f(0.08)
    L.sy += (L.my - L.sy) * f(0.08)
    const wantPush = !reduced && L.pointer && (on || S.view !== 'home')
    L.push += ((wantPush ? 1 : 0) - L.push) * f(0.1)
    uniforms.uPush.value = (on ? 0.4 : 0.22) * L.push
    uniforms.uM.value.set(L.sx * halfW, L.sy * halfH, 0)
    group.current.rotation.x += (-S.tilt * (on ? 1 : 0) - group.current.rotation.x) * f(0.1)
    group.current.rotation.y += ((on && !reduced ? L.sx * 0.2 : 0) - group.current.rotation.y) * f(0.05)

    // tell the landing labels which stage is showing
    S.level = L.k2 > 0.5 ? 2 : L.k1 > 0.5 ? 1 : 0
  })

  useEffect(() => {
    uniforms.uPix.value = 14 * Math.min(devicePixelRatio || 1, 2)
  }, [size, uniforms])

  return (
    <group ref={group}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[A, 3]} />
          <bufferAttribute attach="attributes-aB" args={[B, 3]} />
          <bufferAttribute attach="attributes-aC" args={[C, 3]} />
          <bufferAttribute attach="attributes-aR" args={[R, 2]} />
        </bufferGeometry>
        <primitive object={material} attach="material" />
      </points>
    </group>
  )
}
