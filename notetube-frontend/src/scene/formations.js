// The starting positions of every dot, made once.
//   A  loose cloud, wider than the window (x -5..5, y -3.2..3.2, z -2.5..2.5)
//   B  a page of notes: rows of word-shaped segments, a few marked as highlights
//   C  a fan of four flashcards
//   R  per dot: [seed 0..1, 1 if it is a highlight dot]
export const COUNT = 4200
const rnd = (a, b) => a + Math.random() * (b - a)

export function makeFormations() {
  const A = new Float32Array(COUNT * 3)
  const B = new Float32Array(COUNT * 3)
  const C = new Float32Array(COUNT * 3)
  const R = new Float32Array(COUNT * 2)

  // rows of the notes page
  const seg = []
  let y = 1.5
  let first = true
  while (y > -1.55) {
    if (first) seg.push([y, -1.1, 0.6, 1])
    else {
      let x = -1.1
      while (x < 1.1) {
        const e = Math.min(x + rnd(0.15, 0.5), 1.1)
        if (e - x > 0.08) seg.push([y, x, e, Math.random() < 0.14 ? 1 : 0])
        x = e + 0.09
      }
    }
    y -= first ? 0.4 : Math.random() < 0.2 ? 0.34 : 0.2
    first = false
  }
  const total = seg.reduce((a, s) => a + s[2] - s[1], 0)

  for (let i = 0; i < COUNT; i++) {
    A[i * 3] = rnd(-5, 5)
    A[i * 3 + 1] = rnd(-3.2, 3.2)
    A[i * 3 + 2] = rnd(-2.5, 2.5)

    const back = Math.random() < 0.22
    let r = Math.random() * total
    let j = 0
    while (j < seg.length - 1 && r > seg[j][2] - seg[j][1]) {
      r -= seg[j][2] - seg[j][1]
      j++
    }
    const sg = seg[j]
    B[i * 3] = rnd(sg[1], sg[2]) + (back ? 0.28 : 0)
    B[i * 3 + 1] = sg[0] + rnd(-0.02, 0.02) + (back ? -0.22 : 0)
    B[i * 3 + 2] = back ? -0.45 : rnd(-0.03, 0.03)

    const ci = i % 4
    const ang = (ci - 1.5) * 0.3
    let lx
    let ly
    if (Math.random() < 0.45) {
      if (Math.random() < 0.5) {
        lx = rnd(-0.85, 0.85)
        ly = Math.random() < 0.5 ? -0.58 : 0.58
      } else {
        lx = Math.random() < 0.5 ? -0.85 : 0.85
        ly = rnd(-0.58, 0.58)
      }
    } else {
      lx = rnd(-0.6, 0.6)
      ly = Math.round(rnd(-0.3, 0.3) / 0.14) * 0.14
    }
    const l2 = ly + 1.6
    C[i * 3] = lx * Math.cos(ang) - l2 * Math.sin(ang)
    C[i * 3 + 1] = lx * Math.sin(ang) + l2 * Math.cos(ang) - 1.5
    C[i * 3 + 2] = ci * 0.1

    R[i * 2] = Math.random()
    R[i * 2 + 1] = back ? 0 : sg[3]
  }
  return { A, B, C, R }
}
