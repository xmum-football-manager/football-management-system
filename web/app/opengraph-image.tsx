import { ImageResponse } from 'next/og'
import { loadOgFonts, PitchLogo, PitchBackdrop, OG_SIZE, OG_COLORS } from '@/lib/og'

export const alt = 'Pitch — Live Football Tournaments'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '0 90px',
        background: OG_COLORS.bg, fontFamily: 'Archivo', position: 'relative',
      }}>
        <PitchBackdrop />
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <PitchLogo size={96} />
          <div style={{
            fontFamily: 'Archivo Narrow', fontSize: 120, fontWeight: 700,
            color: OG_COLORS.ink, textTransform: 'uppercase', letterSpacing: -3,
          }}>
            Pitch
          </div>
        </div>
        <div style={{ marginTop: 24, fontSize: 34, color: OG_COLORS.muted, display: 'flex' }}>
          Live football tournaments — scores, standings & fixtures
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await loadOgFonts() }
  )
}
