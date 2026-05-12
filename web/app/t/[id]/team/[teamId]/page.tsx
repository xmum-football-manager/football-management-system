import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string; teamId: string }>
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export async function generateMetadata({ params }: Props) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: team } = await supabase.from('teams').select('name').eq('id', teamId).single()
  if (!team) return { title: 'Team Not Found' }
  return { title: `${team.name} — Roster` }
}

export default async function TeamPage({ params }: Props) {
  const { id, teamId } = await params
  const supabase = await createClient()

  const [teamRes, standingRes] = await Promise.all([
    supabase
      .from('teams')
      .select('*, players(*)')
      .eq('id', teamId)
      .eq('tournament_id', id)
      .single(),
    supabase
      .from('standings')
      .select('*')
      .eq('tournament_id', id)
      .eq('team_id', teamId)
      .single()
  ])

  const team = teamRes.data
  const standing = standingRes.data

  if (!team) notFound()

  const players = [...(team.players ?? [])].sort((a, b) => {
    if (a.jersey_number !== null && b.jersey_number !== null) return a.jersey_number - b.jersey_number
    if (a.jersey_number !== null) return -1
    if (b.jersey_number !== null) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-900)', color: 'var(--ink-50)' }}>
      {/* Header section matches /t/[id] design */}
      <header style={{ padding: '24px 16px', maxWidth: 672, margin: '0 auto' }}>
        <Link 
          href={`/t/${id}`} 
          style={{ 
            color: 'var(--ink-400)', 
            fontSize: 14, 
            display: 'inline-block', 
            marginBottom: 32,
            textDecoration: 'none'
          }}
        >
          ← Back to tournament
        </Link>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48,
            borderRadius: 999, background: 'var(--ink-600)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 18, color: '#fff',
            boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.12), 0 4px 12px rgba(0,0,0,0.3)',
          }}>
            {initials(team.name)}
          </div>
          <div>
            <h1 style={{ 
              margin: 0, 
              fontFamily: 'var(--font-display)', 
              fontWeight: 900, 
              fontSize: 24, 
              letterSpacing: '-0.02em', 
              textTransform: 'uppercase' 
            }}>
              {team.name}
            </h1>
            <p style={{ margin: '2px 0 0', color: 'var(--ink-400)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
              Group A
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 16, 
          fontFamily: 'var(--font-mono)', 
          fontSize: 12, 
          color: 'var(--ink-400)', 
          marginBottom: 32,
          padding: '12px 16px',
          background: 'var(--ink-800)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--ink-700)',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}>
          <span>W: <strong style={{ color: 'var(--ink-50)' }}>{standing?.wins ?? 0}</strong></span>
          <span>D: <strong style={{ color: 'var(--ink-50)' }}>{standing?.draws ?? 0}</strong></span>
          <span>L: <strong style={{ color: 'var(--ink-50)' }}>{standing?.losses ?? 0}</strong></span>
          <span>GD: <strong style={{ color: standing && standing.goal_difference > 0 ? 'var(--brand-lime)' : standing && standing.goal_difference < 0 ? '#f87171' : 'var(--ink-50)' }}>
            {standing?.goal_difference && standing.goal_difference > 0 ? `+${standing.goal_difference}` : standing?.goal_difference ?? 0}
          </strong></span>
          <span style={{ marginLeft: 'auto' }}>Pts: <strong style={{ color: 'var(--brand-lime)', fontSize: 14 }}>{standing?.points ?? 0}</strong></span>
        </div>

        {/* Players list */}
        {players.length === 0 ? (
          <div style={{
            background: 'var(--ink-800)',
            border: '1px solid var(--ink-700)',
            borderRadius: 'var(--radius-lg)',
            padding: '64px 24px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 32, margin: '0 0 12px' }}>👤</p>
            <p style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              color: 'var(--ink-400)',
              margin: 0,
            }}>
              No players registered yet.
            </p>
          </div>
        ) : (
          <div style={{
            background: 'var(--ink-800)',
            border: '1px solid var(--ink-700)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
              }}>
                <thead>
                  <tr>
                    <th style={{
                      padding: '16px',
                      fontFamily: 'var(--font-display)', fontWeight: 800,
                      fontSize: 10, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: 'var(--ink-400)',
                      borderBottom: '1px solid var(--ink-700)',
                      width: 48,
                    }}>#</th>
                    <th style={{
                      padding: '16px',
                      fontFamily: 'var(--font-display)', fontWeight: 800,
                      fontSize: 10, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: 'var(--ink-400)',
                      borderBottom: '1px solid var(--ink-700)',
                    }}>Name</th>
                    <th className="hidden sm:table-cell" style={{
                      padding: '16px',
                      fontFamily: 'var(--font-display)', fontWeight: 800,
                      fontSize: 10, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: 'var(--ink-400)',
                      borderBottom: '1px solid var(--ink-700)',
                    }}>Position</th>
                    <th style={{
                      padding: '16px', textAlign: 'right',
                      fontFamily: 'var(--font-display)', fontWeight: 800,
                      fontSize: 10, letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: 'var(--ink-400)',
                      borderBottom: '1px solid var(--ink-700)',
                    }}>Goals</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: i < players.length - 1 ? '1px solid var(--ink-700)' : 'none' }}>
                      <td style={{
                        padding: '16px',
                        fontFamily: 'var(--font-mono)', fontSize: 13,
                        color: 'var(--ink-400)', fontVariantNumeric: 'tabular-nums',
                      }}>
                        {p.jersey_number ?? '—'}
                      </td>
                      <td style={{
                        padding: '16px',
                        fontFamily: 'var(--font-sans)', fontWeight: 600,
                        color: 'var(--ink-50)',
                      }}>
                        {p.name}
                      </td>
                      <td className="hidden sm:table-cell" style={{
                        padding: '16px',
                        fontFamily: 'var(--font-sans)', fontSize: 13,
                        color: 'var(--ink-400)', textTransform: 'capitalize',
                      }}>
                        {p.position ?? '—'}
                      </td>
                      <td style={{
                        padding: '16px', textAlign: 'right',
                        fontFamily: 'var(--font-mono)', fontSize: 13,
                        color: 'var(--ink-500)', fontVariantNumeric: 'tabular-nums',
                      }}>
                        —
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </header>
    </div>
  )
}