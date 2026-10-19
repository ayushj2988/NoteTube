import type { ReactNode } from 'react'

/** The page's h1. It is focusable (tabIndex -1) so the shell can move focus here after navigation. */
export default function PageHeader({ title, sub, id }: { title: ReactNode; sub?: ReactNode; id?: string }) {
  return (
    <>
      <h1 id={id} tabIndex={-1}>{title}</h1>
      {sub && <p className="sb">{sub}</p>}
    </>
  )
}
