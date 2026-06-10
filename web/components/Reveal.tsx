'use client'

import { useEffect, useRef } from 'react'

/** Fades content in on first scroll into view (.reveal / .reveal.in in globals.css). */
export function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          el.classList.add('in')
          io.unobserve(el)
        }
      })
    }, { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return <div ref={ref} className="reveal">{children}</div>
}
