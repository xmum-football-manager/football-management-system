import { createClient } from '@/lib/supabase/server'
import type { Tournament } from '@/lib/supabase/types'
import { TournamentCardItem } from '@/components/TournamentCardItem'
import { statusBadge, statusRail, formatDateRange, formatLabel } from '@/lib/home-utils'

export const revalidate = 60

export default async function HomePage() {
  let list: Tournament[] = []

  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
    const { MOCK_TOURNAMENTS } = await import('@/lib/dev-fixtures')
    list = MOCK_TOURNAMENTS
  } else {
    const supabase = await createClient()
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('*')
      .in('status', ['active', 'finished'])
      .order('start_date', { ascending: false })

    list = (tournaments ?? []) as Tournament[]
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-900)', color: 'var(--ink-50)' }}>

      {/* ── Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 80,
        background: 'rgba(14,26,18,0.78)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--ink-700)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '14px 28px', maxWidth: 1240, margin: '0 auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logo-mark.svg" alt="Pitch" width={32} height={32} />
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22,
              letterSpacing: '-0.02em', textTransform: 'uppercase',
            }}>Pitch</span>
          </div>
        </div>
      </header>

      {/* ── Active Tournaments ── */}
      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '48px 28px 80px' }}>

        {/* Section heading */}
        <h2 style={{
          fontFamily: 'var(--font-display)', fontWeight: 900,
          fontSize: 'clamp(28px, 4vw, 40px)',
          letterSpacing: '-0.02em', textTransform: 'uppercase',
          color: 'var(--ink-50)', margin: '0 0 24px',
        }}>
          Active Tournaments
        </h2>

        {list.length === 0 ? (
          /* Empty state */
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{
              width: 120, height: 120, margin: '0 auto 28px',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--ink-800)',
              border: '1px solid var(--ink-700)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--ink-500)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28,
              letterSpacing: '-0.01em', textTransform: 'uppercase',
              color: 'var(--ink-100)', margin: 0,
            }}>No tournaments running right now</h2>
            <p style={{
              marginTop: 10, fontSize: 15, color: 'var(--ink-400)',
              maxWidth: 360, marginLeft: 'auto', marginRight: 'auto',
            }}>
              Check back soon.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map((t) => (
              <TournamentCardItem
                key={t.id}
                tournament={t}
                badge={statusBadge(t.status)}
                rail={statusRail(t.status)}
                dateRange={formatDateRange(t.start_date, t.end_date)}
                formatLabel={formatLabel(t.format)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid var(--ink-700)',
        padding: '40px 28px 56px',
        background: 'var(--ink-900)',
      }}>
        <div style={{
          maxWidth: 1240, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
          color: 'var(--ink-400)', fontSize: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo-mark.svg" alt="Pitch" width={24} height={24} />
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 16, letterSpacing: '-0.01em', textTransform: 'uppercase',
              color: 'var(--ink-50)',
            }}>Pitch</span>
            <span>Live tournaments, friends &amp; rivals.</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-500)' }}>
            &copy; {new Date().getFullYear()} PitchSide
          </span>
        </div>
      </footer>
    </div>
  )
}
