// Shared building blocks for generated Open Graph images (next/og ImageResponse)
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const OG_SIZE = { width: 1200, height: 630 }

export const OG_COLORS = {
  bg: '#0E1A12',
  lime: '#A3E635',
  ink: '#F4F7EE',
  muted: 'rgba(244,247,238,0.72)',
}

export async function loadOgFonts() {
  const [display, sans] = await Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/ArchivoNarrow-Bold.ttf')),
    readFile(join(process.cwd(), 'assets/fonts/Archivo-Medium.ttf')),
  ])
  return [
    { name: 'Archivo Narrow', data: display, weight: 700 as const, style: 'normal' as const },
    { name: 'Archivo', data: sans, weight: 500 as const, style: 'normal' as const },
  ]
}

// Lime version of the logo mark (logo-wordmark-dark.svg) — pops on the dark background
export function PitchLogo({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="14" fill={OG_COLORS.lime} />
      <circle cx="32" cy="32" r="14" fill={OG_COLORS.bg} />
      <path d="M32 22 L38 26 L36 33 L28 33 L26 26 Z" fill={OG_COLORS.lime} />
      <path d="M22 32 L26 34 L26 40 L22 38 Z" fill={OG_COLORS.lime} />
      <path d="M42 32 L38 34 L38 40 L42 38 Z" fill={OG_COLORS.lime} />
      <path d="M28 41 L36 41 L34 46 L30 46 Z" fill={OG_COLORS.lime} />
    </svg>
  )
}

// Mowing stripes + halfway line + centre circle, like a pitch seen from the side
export function PitchBackdrop() {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{ width: 200, height: 630, background: i % 2 ? 'rgba(244,247,238,0.025)' : 'transparent' }}
        />
      ))}
      <div style={{ position: 'absolute', left: 1018, top: -120, width: 2, height: 870, background: 'rgba(244,247,238,0.08)' }} />
      <div style={{
        position: 'absolute', left: 869, top: 165, width: 300, height: 300,
        borderRadius: 150, border: '2px solid rgba(244,247,238,0.08)',
      }} />
      <div style={{ position: 'absolute', left: 0, bottom: 0, width: 1200, height: 10, background: OG_COLORS.lime }} />
    </div>
  )
}
