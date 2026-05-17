'use client'

import { useEffect, useState, useCallback, useLayoutEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MatchCard } from '@/components/MatchCard'
import { StandingsCard } from '@/components/StandingsCard'
import { TeamCard } from '@/components/TeamCard'
import { HeroLive } from '@/components/HeroLive'
import { BracketView } from '@/components/BracketView'
import { QrModal } from '@/components/QrModal'
import { LiveBadge } from '@/components/LiveBadge'
import Link from 'next/link'
import type { Tournament, MatchWithTeams, Standing, Team, Player } from '@/lib/supabase/types'

type Tab = 'live' | 'fixtures' | 'standings' | 'bracket' | 'teams'

const baseTabs: { id: Tab; label: string }[] = [
  { id: 'live',      label: 'Live' },
  { id: 'fixtures',  label: 'Fixtures' },
  { id: 'standings', label: 'Standings' },
  { id: 'bracket',   label: 'Bracket' },
  { id: 'teams',     label: 'Teams' },
]

interface TournamentViewProps {
  tournament: Tournament
  initialMatches: MatchWithTeams[]
  initialStandings: Standing[]
  initialTeams: Array<Team & { players: Player[] }>
}

// ── Tab Strip ──────────────────────────────────────────────────────────────────
function TabStrip({ tabs, tab, setTab }: { tabs: { id: Tab; label: string }[]; tab: Tab; setTab: (t: Tab) => void }) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const stripRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ x: 0, w: 0 })

  useLayoutEffect(() => {
    const el = tabRefs.current[tab]
    const strip = stripRef.current
    if (!el || !strip) return
    const er = el.getBoundingClientRect()
    const sr = strip.getBoundingClientRect()
    setIndicator({ x: (er.left - sr.left) + strip.scrollLeft, w: er.width })
  }, [tab])

  return (
    <div style={{
      position: 'sticky', top: 57, zIndex: 70,
      background: 'rgba(14,26,18,0.92)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      borderBottom: '1px solid var(--ink-700)',
    }}>
      <div ref={stripRef} style={{
        display: 'flex', alignItems: 'center',
        maxWidth: 1400, margin: '0 auto',
        padding: 0,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        position: 'relative',
      }}>
        {/* Left spacer — replaces padding-left */}
        <span style={{ flexShrink: 0, width: 16 }} aria-hidden />
        {tabs.map(t => (
          <button
            key={t.id}
            ref={el => { tabRefs.current[t.id] = el }}
            onClick={() => setTab(t.id)}
            style={{
              flexShrink: 0,
              padding: '16px 14px',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: tab === t.id ? 'var(--brand-lime)' : 'var(--ink-300)',
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color var(--dur-fast) var(--ease-out)',
            }}
          >
            {t.label}
          </button>
        ))}
        {/* Right spacer — preserves right padding past scroll edge */}
        <span style={{ flexShrink: 0, width: 16 }} aria-hidden />
        <span style={{
          position: 'absolute',
          bottom: 0,
          height: 3,
          background: 'var(--brand-lime)',
          borderRadius: '999px 999px 0 0',
          transform: `translateX(${indicator.x}px)`,
          width: indicator.w,
          transition: 'transform 420ms var(--ease-out), width 420ms var(--ease-out)',
          boxShadow: '0 0 12px rgba(163,230,53,0.6)',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  )
}

// ── Section wrapper ─────────────────────────────────────────────────────────────
function SectionHead({ eyebrow, title, accent, right }: {
  eyebrow: string
  title: string
  accent: string
  right?: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      gap: 24, marginBottom: 36, flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brand-lime)',
        }}>{eyebrow}</span>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontWeight: 900,
          fontSize: 'clamp(36px, 5vw, 64px)', lineHeight: 0.92,
          letterSpacing: '-0.02em', textTransform: 'uppercase', margin: 0,
          color: 'var(--ink-50)',
        }}>
          {title} <span style={{ color: 'var(--brand-lime)', fontStyle: 'italic' }}>{accent}</span>
        </h2>
      </div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{right}</div>}
    </div>
  )
}

// ── Filter chips ────────────────────────────────────────────────────────────────
type MatchFilter = 'all' | 'live' | 'scheduled' | 'finished'

function FilterChips({ value, onChange }: { value: MatchFilter; onChange: (v: MatchFilter) => void }) {
  const chips: { id: MatchFilter; label: string }[] = [
    { id: 'all',       label: 'All' },
    { id: 'live',      label: 'Live now' },
    { id: 'scheduled', label: 'Upcoming' },
    { id: 'finished',  label: 'Full time' },
  ]
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {chips.map(c => (
        <button key={c.id} onClick={() => onChange(c.id)} style={{
          padding: '8px 14px',
          background: value === c.id ? 'var(--brand-lime)' : 'var(--ink-800)',
          border: `1px solid ${value === c.id ? 'var(--brand-lime)' : 'var(--ink-700)'}`,
          borderRadius: 999,
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: value === c.id ? 'var(--ink-900)' : 'var(--ink-300)',
          cursor: 'pointer',
          transition: 'all var(--dur-fast) var(--ease-out)',
        }}>{c.label}</button>
      ))}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────────
export function TournamentView({ tournament, initialMatches, initialStandings, initialTeams }: TournamentViewProps) {
  const defaultTab = initialMatches.some(m => m.status === 'live') ? 'live' : 'fixtures'
  const [tab, setTab] = useState<Tab>(defaultTab)
  const [matches, setMatches] = useState(initialMatches)
  const [standings, setStandings] = useState(initialStandings)
  const [connected, setConnected] = useState(true)
  const [fixtureFilter, setFixtureFilter] = useState<MatchFilter>('all')
  const [showQr, setShowQr] = useState(false)

  const tabs = useMemo(() => {
    return tournament.format === 'round_robin' 
      ? baseTabs.filter(t => t.id !== 'bracket')
      : baseTabs
  }, [tournament.format])

  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          let current: Tab | null = null
          for (const t of tabs) {
            const el = document.getElementById(t.id)
            if (el) {
              const rect = el.getBoundingClientRect()
              if (rect.top <= 200) {
                current = t.id as Tab
              }
            }
          }
          if (current) setTab(current)
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [tabs])

  const handleTabClick = (t: Tab) => {
    setTab(t)
    const el = document.getElementById(t)
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 120
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  const refetch = useCallback(async () => {
    const supabase = createClient()
    const [{ data: m }, { data: s }] = await Promise.all([
      supabase.from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
        .eq('tournament_id', tournament.id).order('match_time', { ascending: true }),
      supabase.from('standings').select('*').eq('tournament_id', tournament.id),
    ])
    if (m) setMatches(m as MatchWithTeams[])
    if (s) setStandings(s as Standing[])
  }, [tournament.id])

  useEffect(() => {
    const supabase = createClient()
    let fallbackInterval: ReturnType<typeof setInterval> | null = null
    const channel = supabase.channel(`t-${tournament.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `tournament_id=eq.${tournament.id}` }, () => refetch())
      .subscribe(status => {
        if (status === 'SUBSCRIBED') { setConnected(true); if (fallbackInterval) { clearInterval(fallbackInterval); fallbackInterval = null } }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnected(false)
          if (!fallbackInterval) fallbackInterval = setInterval(refetch, 30000)
        }
      })
    return () => { supabase.removeChannel(channel); if (fallbackInterval) clearInterval(fallbackInterval) }
  }, [tournament.id, refetch])

  useEffect(() => {
    const handler = () => { if (!document.hidden) refetch() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [refetch])

  const liveMatches     = matches.filter(m => m.status === 'live')
  const upcomingMatches = matches.filter(m => m.status === 'scheduled')
  const finishedMatches = matches.filter(m => m.status === 'finished')

  const [whatsappUrl, setWhatsappUrl] = useState('#')
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWhatsappUrl(`https://wa.me/?text=${encodeURIComponent(`⚽ ${tournament.name} — live scores & standings: ${window.location.href}`)}`)
  }, [tournament.name])

  const filteredFixtures = fixtureFilter === 'all' ? matches : matches.filter(m => m.status === fixtureFilter)

  // Smart stage label — no DB column needed
  const stageLabel = (() => {
    if (matches.length === 0) return 'Pre-Tournament'
    if (liveMatches.length > 0) return 'Matchday in Progress'
    if (upcomingMatches.length === 0 && finishedMatches.length > 0) return 'Tournament Finished'
    if (tournament.format === 'knockout') return 'Knockout Stage'
    if (tournament.format === 'round_robin_knockout' && upcomingMatches.length === 0) return 'Knockout Stage'
    return 'Group Stage'
  })()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-900)' }}>

      {/* ── Top Nav ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 80,
        background: 'rgba(14,26,18,0.78)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--ink-700)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 28px', maxWidth: 1400, margin: '0 auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/" style={{
              fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22,
              letterSpacing: '-0.02em', textTransform: 'uppercase', color: 'var(--ink-50)',
              textDecoration: 'none',
            }}>Pitch</Link>
          </div>
        </div>
      </header>

      {showQr && typeof window !== 'undefined' && (
        <QrModal url={window.location.href} onClose={() => setShowQr(false)} />
      )}

      {/* ── Offline banner ── */}
      {!connected && (
        <div style={{
          background: 'rgba(120,80,0,0.7)', color: '#fde68a',
          fontSize: 12, textAlign: 'center', padding: '8px 16px',
        }}>
          Live updates paused — refreshing every 30s
        </div>
      )}

      {/* ── Tournament Header ── */}
      <div style={{
        background: 'var(--ink-900)',
        padding: '32px 28px 28px',
        maxWidth: 1240, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            {liveMatches.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <LiveBadge />
              </div>
            )}
            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(28px, 5vw, 52px)', letterSpacing: '-0.02em',
              textTransform: 'uppercase', margin: '0 0 8px', color: 'var(--ink-50)',
              lineHeight: 0.95,
            }}>{tournament.name}</h1>
            <p style={{
              fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 16,
              color: 'var(--ink-300)', margin: 0,
            }}>
              {stageLabel} &middot; {tournament.location ?? 'Tournament'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, borderRadius: 999,
              border: '1.5px solid var(--ink-700)',
              background: 'var(--ink-800)', color: 'var(--ink-50)',
              textDecoration: 'none',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
            <button onClick={() => setShowQr(true)} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 44, height: 44, borderRadius: 999,
              border: '1.5px solid var(--ink-700)',
              background: 'var(--ink-800)', color: 'var(--ink-50)',
              cursor: 'pointer',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM21 21v-6h-6v6h6zM9 21h3v-3H9v3zM15 15h3v-3h-3v3zM9 9h6v6H9V9z" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab strip ── */}
      <TabStrip tabs={tabs} tab={tab} setTab={handleTabClick} />

      {/* ── Hero live scoreboard (first live match) ── */}
      {liveMatches.length > 0 && <HeroLive match={liveMatches[0]} />}

      {/* ── Tab content ── */}
      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '0 28px' }}>

        {/* LIVE tab */}
        <section id="live" style={{ padding: '64px 0 56px' }}>
          <SectionHead eyebrow="Right now" title="What's" accent="live" />
          {matches.length === 0 && (
            <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--ink-400)' }}>
              <p style={{ fontSize: 48, margin: '0 0 12px' }}>⚽</p>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--ink-300)', margin: 0 }}>
                No matches scheduled yet.
              </p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {liveMatches.length > 0 && (
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--red-card)', marginBottom: 14 }}>● Live now</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
                  {liveMatches.map(m => <MatchCard key={m.id} match={m} />)}
                </div>
              </div>
            )}
            {upcomingMatches.length > 0 && (
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--brand-lime)', marginBottom: 14 }}>Upcoming</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
                  {upcomingMatches.slice(0, 5).map(m => <MatchCard key={m.id} match={m} />)}
                </div>
              </div>
            )}
            {finishedMatches.length > 0 && (
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-400)', marginBottom: 14 }}>Recent results</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
                  {[...finishedMatches].reverse().slice(0, 3).map(m => <MatchCard key={m.id} match={m} />)}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* FIXTURES tab */}
        <section id="fixtures" style={{ padding: '64px 0 56px' }}>
          <SectionHead
            eyebrow="Full schedule"
            title="All"
            accent="fixtures"
            right={<FilterChips value={fixtureFilter} onChange={setFixtureFilter} />}
          />
          {filteredFixtures.length === 0
            ? <p style={{ color: 'var(--ink-400)', textAlign: 'center', padding: '48px 0' }}>No matches for this filter.</p>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {filteredFixtures.map(m => <MatchCard key={m.id} match={m} />)}
              </div>
            )
          }
        </section>

        {/* STANDINGS tab */}
        <section id="standings" style={{ padding: '64px 0 56px' }}>
          <SectionHead eyebrow="Group stage" title="The" accent="table" />
          {standings.length === 0
            ? <p style={{ color: 'var(--ink-400)', textAlign: 'center', padding: '48px 0' }}>No matches played yet.</p>
            : <StandingsCard standings={standings} />
          }
        </section>

        {/* BRACKET tab */}
        {tournament.format !== 'round_robin' && (
          <section id="bracket" style={{ padding: '64px 0 56px' }}>
            <SectionHead eyebrow="Knockout stage" title="The" accent="bracket" right={
              <span style={{ color: 'var(--ink-400)', fontSize: 14 }}>Single elimination</span>
            } />
            <BracketView matches={matches.filter(m => m.status !== 'scheduled' || true)} />
          </section>
        )}

        {/* TEAMS tab */}
        {tab === 'teams' && (
          <section style={{ padding: '64px 0 56px' }}>
            <SectionHead
              eyebrow={`${initialTeams.length} clubs`}
              title="The"
              accent="teams"
              right={<span style={{ color: 'var(--ink-400)', fontSize: 14 }}>Tap a team to see the roster</span>}
            />
            {initialTeams.length === 0
              ? <p style={{ color: 'var(--ink-400)', textAlign: 'center', padding: '48px 0' }}>No teams added yet.</p>
              : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
                  {initialTeams.map(team => <TeamCard key={team.id} team={team} standings={standings} tournamentId={tournament.id} />)}
                </div>
              )
            }
          </section>
        )}

      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid var(--ink-700)',
        padding: '40px 28px 56px',
        marginTop: 32,
      }}>
        <div style={{
          maxWidth: 1240, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
          color: 'var(--ink-400)', fontSize: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 18, letterSpacing: '-0.01em', textTransform: 'uppercase',
              color: 'var(--ink-50)',
            }}>Pitch</span>
            <span>Live tournaments, friends &amp; rivals.</span>
          </div>
          {tournament.location && <span style={{ color: 'var(--brand-lime)' }}>{tournament.location}</span>}
        </div>
      </footer>
    </div>
  )
}
