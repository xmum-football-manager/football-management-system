'use client'

import { useEffect, useState, useCallback, useLayoutEffect, useRef, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { createClient } from '@/lib/supabase/client'
import { withTeamFallback } from '@/lib/match-teams'
import { teamCode, teamColor } from '@/lib/team-style'
import { mediaUrl } from '@/lib/storage'
import { MatchCard } from '@/components/MatchCard'
import { MatchModal } from '@/components/MatchModal'
import { StandingsTable } from '@/components/StandingsTable'
import { TeamCard } from '@/components/TeamCard'
import { HeroLive } from '@/components/HeroLive'
import { BracketView } from '@/components/BracketView'
import { Reveal } from '@/components/Reveal'
import Link from 'next/link'
import Image from 'next/image'
import type { Tournament, MatchWithTeams, Standing, Team, Player, TopScorer, TeamCardCount } from '@/lib/supabase/types'

type Tab = 'live' | 'fixtures' | 'standings' | 'bracket' | 'scorers' | 'teams'

const baseTabs: { id: Tab; label: string }[] = [
  { id: 'live',      label: 'Live' },
  { id: 'fixtures',  label: 'Fixtures' },
  { id: 'standings', label: 'Standings' },
  { id: 'bracket',   label: 'Bracket' },
  { id: 'scorers',   label: 'Scorers' },
  { id: 'teams',     label: 'Teams' },
]

interface TournamentViewProps {
  tournament: Tournament
  initialMatches: MatchWithTeams[]
  initialStandings: Standing[]
  initialTeams: Array<Team & { players: Player[] }>
  topScorers: TopScorer[]
  cardCounts: TeamCardCount[]
}

// ── Tab Strip ──────────────────────────────────────────────────────────────────
function TabStrip({ tabs, tab, setTab }: { tabs: { id: Tab; label: string }[]; tab: Tab; setTab: (t: Tab) => void }) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [indicator, setIndicator] = useState({ x: 0, w: 0 })

  useLayoutEffect(() => {
    let cancelled = false
    const measure = () => {
      const el = tabRefs.current[tab]
      if (cancelled || !el) return
      setIndicator({ x: el.offsetLeft, w: el.offsetWidth })
    }
    measure()
    // Re-measure once the display font loads and on resize — measuring against
    // fallback-font metrics is what left the underline misaligned.
    void document.fonts.ready.then(measure)
    window.addEventListener('resize', measure)
    return () => { cancelled = true; window.removeEventListener('resize', measure) }
  }, [tab])

  return (
    <div className="tabstrip-wrap">
      <div className="tabstrip">
        {tabs.map(t => (
          <button
            key={t.id}
            ref={el => { tabRefs.current[t.id] = el }}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span className="tab-indicator" style={{ transform: `translateX(${indicator.x}px)`, width: indicator.w }} />
      </div>
    </div>
  )
}

// ── Section header ──────────────────────────────────────────────────────────────
function SectionHead({ eyebrow, title, accent, right }: {
  eyebrow: string
  title: string
  accent: string
  right?: React.ReactNode
}) {
  return (
    <div className="section-head">
      <div className="left">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="section-title">{title} <span className="accent">{accent}</span></h2>
      </div>
      {right && <div className="right">{right}</div>}
    </div>
  )
}

// ── Filter chips ────────────────────────────────────────────────────────────────
type MatchFilter = 'all' | 'live' | 'scheduled'

function FilterChips({ value, onChange }: { value: MatchFilter; onChange: (v: MatchFilter) => void }) {
  const chips: { id: MatchFilter; label: string }[] = [
    { id: 'all',       label: 'All' },
    { id: 'live',      label: 'Live now' },
    { id: 'scheduled', label: 'Upcoming' },
  ]
  return (
    <div className="chips">
      {chips.map(c => (
        <button key={c.id} className={`chip ${value === c.id ? 'active' : ''}`} onClick={() => onChange(c.id)}>
          {c.label}
        </button>
      ))}
    </div>
  )
}

// ── Results ticker ──────────────────────────────────────────────────────────────
function Ticker({ matches, onSelect }: { matches: MatchWithTeams[]; onSelect?: (id: string) => void }) {
  const finished = matches.filter(m => m.status === 'finished').slice(-12).reverse()
  if (finished.length === 0) return null

  // Repeat the sequence so the -50% marquee loop is seamless even with few results
  const seq: MatchWithTeams[] = []
  while (seq.length < 5) seq.push(...finished)
  const items = [...seq, ...seq]

  return (
    <div className="ticker">
      <div className="ticker-track">
        {items.map((m, i) => (
          <span
            className={`ticker-item ${onSelect ? 'clickable' : ''}`}
            key={i}
            onClick={onSelect ? () => onSelect(m.id) : undefined}
          >
            <span className="ic">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#1E78F0" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6 L14 10 L18 10 L15 13 L16 17 L12 15 L8 17 L9 13 L6 10 L10 10 Z" fill="#060C1C"/>
              </svg>
            </span>
            <span className="min">FT</span>
            <span className="match">{teamCode(m.home_team.name)} {m.home_score}–{m.away_score} {teamCode(m.away_team.name)}</span>
            <span className="text">{m.home_team.name} vs {m.away_team.name}</span>
            <span className="ticker-sep" />
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Share button ────────────────────────────────────────────────────────────────
function ShareButton({ title }: { title: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Modal content only renders client-side after the trigger is clicked,
  // so window/navigator are safe to read here.
  const url = typeof window === 'undefined' ? '' : window.location.href
  const enc = encodeURIComponent

  const socials = [
    {
      name: 'WhatsApp',
      href: `https://wa.me/?text=${enc(`${title} ${url}`)}`,
      icon: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>,
    },
    {
      name: 'Telegram',
      href: `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}`,
      icon: <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>,
    },
    {
      name: 'X',
      href: `https://x.com/intent/post?url=${enc(url)}&text=${enc(title)}`,
      icon: <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>,
    },
    {
      name: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      icon: <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>,
    },
  ]

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const nativeShare = async () => {
    try { await navigator.share({ title, url }) } catch { /* user dismissed */ }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCopied(false) }}>
      <Dialog.Trigger asChild>
        <button className="btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>
          </svg>
          <span>Share</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="share-overlay" />
        <Dialog.Content className="share-modal">
          <Dialog.Title className="share-title">Share <span className="accent">tournament</span></Dialog.Title>
          <Dialog.Description className="share-desc">Send this page to players, fans &amp; rivals.</Dialog.Description>

          <div className="share-socials">
            {socials.map(s => (
              <a key={s.name} className="share-social" href={s.href} target="_blank" rel="noopener noreferrer">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{s.icon}</svg>
                <span>{s.name}</span>
              </a>
            ))}
          </div>

          <div className="share-link-row">
            <input className="share-link" value={url} readOnly onFocus={e => e.currentTarget.select()} />
            <button className="btn btn-lime" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
          </div>

          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button className="btn share-native" onClick={nativeShare}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>
              </svg>
              <span>More options&hellip;</span>
            </button>
          )}

          <Dialog.Close asChild>
            <button className="share-close" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ── Inline team chip (crest + name, for running text) ──────────────────────────
function InlineTeam({ team }: { team: Team }) {
  const logo = mediaUrl(team.logo_path)
  return (
    <span className="inline-team">
      <span
        className="crest"
        style={
          logo
            ? { backgroundImage: `url(${logo})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: teamColor(team.id) }
        }
      >
        {logo ? null : teamCode(team.name)}
      </span>
      {team.name}
    </span>
  )
}

// ── Champion hero (tournament finished) ─────────────────────────────────────────
function ChampionHero({ team, note, metaText }: { team: Team; note: React.ReactNode; metaText: React.ReactNode }) {
  const logo = mediaUrl(team.logo_path)
  return (
    <section className="hero champion" id="live">
      <div className="hero-inner">
        <div className="hero-meta">
          <span className="live-pill lime">Tournament finished</span>
          <span className="match-meta-text">{metaText}</span>
        </div>
        <div className="champion-hero">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--brand-lime)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
            <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
          </svg>
          <span className="champion-eyebrow">Champion</span>
          <div className="champion-team">
            <span
              className="crest"
              style={
                logo
                  ? { backgroundImage: `url(${logo})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : { background: teamColor(team.id) }
              }
            >
              {logo ? null : teamCode(team.name)}
            </span>
            <h2 className="champion-name">{team.name}</h2>
          </div>
          <p className="champion-note">{note}</p>
        </div>
      </div>
    </section>
  )
}

// ── Main component ──────────────────────────────────────────────────────────────
export function TournamentView({ tournament, initialMatches, initialStandings, initialTeams, topScorers, cardCounts }: TournamentViewProps) {
  const [tab, setTab] = useState<Tab>('live')
  const [matches, setMatches] = useState(initialMatches)
  const [standings, setStandings] = useState(initialStandings)
  const [connected, setConnected] = useState(true)
  const [fixtureFilter, setFixtureFilter] = useState<MatchFilter>('all')
  // Store the id, not the object — realtime refetches then keep the open modal fresh
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)

  const tabs = useMemo(() => {
    let list = baseTabs
    if (tournament.format === 'round_robin') {
      list = list.filter((t) => t.id !== 'bracket')
    }
    if (tournament.format === 'knockout') {
      list = list.filter((t) => t.id !== 'standings')
    }
    if (topScorers.length === 0) {
      list = list.filter((t) => t.id !== 'scorers')
    }
    return list
  }, [tournament.format, topScorers.length])

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

  // Only scroll on click — the scrollspy drives the active tab, so the
  // indicator sweeps along with the smooth scroll instead of jumping ahead
  // and fighting it.
  const handleTabClick = (t: Tab) => {
    const el = document.getElementById(t)
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 116
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  const refetch = useCallback(async () => {
    const supabase = createClient()
    const [{ data: m }, { data: s }] = await Promise.all([
      supabase.from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
        .eq('tournament_id', tournament.id).order('match_time', { ascending: false }),
      supabase.from('standings').select('*').eq('tournament_id', tournament.id),
    ])
    if (m) setMatches(withTeamFallback(m as MatchWithTeams[]).filter(x => x.match_time !== null))
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
          // Only poll while the page is visible — the visibilitychange handler
          // below refetches immediately when the user returns to the tab.
          if (!fallbackInterval) fallbackInterval = setInterval(() => { if (!document.hidden) refetch() }, 30000)
        }
      })
    return () => { supabase.removeChannel(channel); if (fallbackInterval) clearInterval(fallbackInterval) }
  }, [tournament.id, refetch])

  useEffect(() => {
    const handler = () => { if (!document.hidden) refetch() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [refetch])

  // Filter out unscheduled (null match_time) matches — not yet public
  const scheduledMatches = matches.filter((m) => m.match_time !== null)

  const liveMatches     = scheduledMatches.filter(m => m.status === 'live' || m.status === 'halftime')
  const upcomingMatches = scheduledMatches.filter(m => m.status === 'scheduled')
  const finishedMatches = scheduledMatches.filter(m => m.status === 'finished')

  const filteredFixtures = fixtureFilter === 'all' ? scheduledMatches : scheduledMatches.filter(m => m.status === fixtureFilter)

  // Hero shows the live match; otherwise the next kickoff; otherwise the last result
  const heroMatch = liveMatches[0] ?? upcomingMatches[0] ?? finishedMatches[finishedMatches.length - 1] ?? null

  // Smart stage label — no DB column needed
  const stageLabel = (() => {
    if (matches.length === 0) return 'Pre-Tournament'
    if (liveMatches.length > 0) return 'Matchday in Progress'
    if (upcomingMatches.length === 0 && finishedMatches.length > 0) return 'Tournament Finished'
    if (tournament.format === 'knockout') return 'Knockout Stage'
    if (tournament.format === 'round_robin_knockout' && upcomingMatches.length === 0) return 'Knockout Stage'
    if (tournament.format === 'round_robin') return 'League Stage'
    return 'Group Stage'
  })()

  const heroMeta = (
    <>
      <strong>{tournament.name}</strong> &middot; {stageLabel}
      {tournament.location && <> &middot; {tournament.location}</>}
    </>
  )

  const selectedMatch = selectedMatchId ? matches.find(m => m.id === selectedMatchId) ?? null : null

  // Tournament champion — knockout: winner of the final; league: table leader
  const champion: { team: Team; note: React.ReactNode } | null = (() => {
    if (stageLabel !== 'Tournament Finished') return null
    if (tournament.format === 'round_robin') {
      const sorted = [...standings].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
        return a.team_name.localeCompare(b.team_name)
      })
      const top = sorted[0]
      const team = top && initialTeams.find(t => t.id === top.team_id)
      return team ? { team, note: `Topped the table with ${top.points} pts` } : null
    }
    const ko = scheduledMatches.filter(m => m.phase === 'knockout')
    const final = ko.find(m => m.knockout_round === 'final') ?? ko[ko.length - 1]
    if (!final || final.status !== 'finished' || final.home_score === final.away_score) return null
    const won = final.home_score > final.away_score
    const team = won ? final.home_team : final.away_team
    const loser = won ? final.away_team : final.home_team
    return {
      team,
      note: (
        <>
          Won the final {Math.max(final.home_score, final.away_score)}–{Math.min(final.home_score, final.away_score)} against <InlineTeam team={loser} />
        </>
      ),
    }
  })()

  const logoUrl = mediaUrl(tournament.logo_path)
  const bannerUrl = mediaUrl(tournament.banner_path)
  const teamLogos = Object.fromEntries(initialTeams.map(t => [t.id, t.logo_path]))

  const groupMatchesPlayed = finishedMatches.length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-900)' }}>

      {/* ── Top Nav ── */}
      <header className="topnav">
        <div className="topnav-inner">
          <div className="topnav-brand">
            <Image src="/logo-mark.svg" alt="" width={32} height={32} />
            <Link href="/" className="name">Pitch</Link>
            <span className="topnav-tourney">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  // display: inline-block overrides Tailwind preflight's `img { display: block }`,
                  // which otherwise pushes the logo onto its own line above the text
                  style={{ display: 'inline-block', width: 20, height: 20, borderRadius: 999, objectFit: 'cover', verticalAlign: 'middle', marginRight: 6 }}
                />
              )}
              {tournament.name} &middot; <span style={{ color: 'var(--brand-lime)' }}>{new Date(tournament.start_date).getFullYear()}</span>
            </span>
          </div>
          <div className="topnav-actions">
            <ShareButton title={tournament.name} />
          </div>
        </div>
      </header>

      {/* ── Offline banner ── */}
      {!connected && (
        <div style={{
          background: 'rgba(120,80,0,0.7)', color: '#fde68a',
          fontSize: 12, textAlign: 'center', padding: '8px 16px',
        }}>
          Live updates paused — refreshing every 30s
        </div>
      )}

      {/* ── Tournament banner ── */}
      {bannerUrl && (
        <div style={{ position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerUrl}
            alt=""
            style={{ width: '100%', height: 'clamp(140px, 24vw, 260px)', objectFit: 'cover', display: 'block' }}
          />
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.25), transparent 40%, var(--ink-900))',
          }} />
        </div>
      )}

      {/* ── Tab strip ── */}
      <TabStrip tabs={tabs} tab={tab} setTab={handleTabClick} />

      {/* ── Hero (champion > live/next kickoff/last result > coming soon) ── */}
      {champion ? (
        <ChampionHero team={champion.team} note={champion.note} metaText={heroMeta} />
      ) : heroMatch ? (
        <HeroLive
          match={heroMatch}
          allMatches={scheduledMatches}
          metaText={heroMeta}
          minutesPerHalf={tournament.minutes_per_half}
        />
      ) : (
        <section className="hero" id="live">
          <div className="hero-inner">
            <div className="hero-meta">
              <span className="live-pill dim">Coming soon</span>
              <span className="match-meta-text">{heroMeta}</span>
            </div>
            <h1 className="section-title">{tournament.name}</h1>
            <p className="match-meta-text" style={{ marginTop: 16 }}>
              Fixtures will appear here once the schedule is published.
            </p>
          </div>
        </section>
      )}

      {/* ── Results ticker ── */}
      <Ticker matches={scheduledMatches} onSelect={setSelectedMatchId} />

      {/* FIXTURES */}
      <section className="section" id="fixtures">
        <div className="container">
          <SectionHead
            eyebrow="Full schedule"
            title="All"
            accent="fixtures"
            right={<FilterChips value={fixtureFilter} onChange={setFixtureFilter} />}
          />
          {filteredFixtures.length === 0
            ? <p style={{ color: 'var(--ink-400)', textAlign: 'center', padding: '48px 0' }}>No matches for this filter.</p>
            : (
              <Reveal>
                <div className="fixtures-grid">
                  {filteredFixtures.map(m => <MatchCard key={m.id} match={m} tournamentStartDate={tournament.start_date} onClick={() => setSelectedMatchId(m.id)} />)}
                </div>
              </Reveal>
            )
          }
        </div>
      </section>

      {/* STANDINGS */}
      {tournament.format !== 'knockout' && (
        <section className="section" id="standings" style={{ background: 'rgba(0,0,0,0.18)' }}>
          <div className="container">
            <SectionHead
              eyebrow={tournament.format === 'round_robin_knockout' ? 'Group stage' : 'League'}
              title="The"
              accent="table"
              right={
                <span className="match-meta-text">
                  {groupMatchesPlayed > 0 ? `After ${groupMatchesPlayed} of ${scheduledMatches.length} matches played` : 'No matches played yet'}
                </span>
              }
            />
            <Reveal>
              {tournament.format === 'round_robin_knockout' ? (
                <GroupStandings
                  initialTeams={initialTeams}
                  matches={matches}
                  standings={standings}
                  advancePerGroup={tournament.advance_per_group ?? 2}
                  cardCounts={cardCounts}
                />
              ) : (
                <div className="standings-shell">
                  <StandingsTable
                    standings={standings}
                    matches={matches}
                    groupLabel={tournament.name}
                    advanceCount={0}
                    teamLogos={teamLogos}
                    cardCounts={cardCounts}
                  />
                </div>
              )}
            </Reveal>
          </div>
        </section>
      )}

      {/* BRACKET */}
      {tournament.format !== 'round_robin' && (
        <section className="section" id="bracket" style={{ background: 'rgba(0,0,0,0.22)' }}>
          <div className="container">
            <SectionHead
              eyebrow="Knockout stage"
              title="The"
              accent="bracket"
              right={<span className="match-meta-text">Single elimination</span>}
            />
            <Reveal>
              <BracketView
                matches={matches.filter((m) => m.phase === 'knockout')}
                onMatchClick={(m) => setSelectedMatchId(m.id)}
              />
            </Reveal>
          </div>
        </section>
      )}

      {/* TOP PLAYERS */}
      {topScorers.length > 0 && (
        <section className="section" id="scorers" style={{ background: 'rgba(0,0,0,0.18)' }}>
          <div className="container">
            <SectionHead
              eyebrow="Goal scorers"
              title="Top"
              accent="scorers"
            />
            <Reveal>
              <div className="standings-shell">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-400)', borderBottom: '1px solid var(--ink-700)' }}>#</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-400)', borderBottom: '1px solid var(--ink-700)' }}>Player</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-400)', borderBottom: '1px solid var(--ink-700)' }}>Team</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-400)', borderBottom: '1px solid var(--ink-700)' }}>Goals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topScorers.map((s, i) => (
                      <tr key={s.player_id} style={{ borderBottom: i < topScorers.length - 1 ? '1px solid var(--ink-700)' : 'none' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-500)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-sans)', fontWeight: 600, color: 'var(--ink-50)' }}>{s.player_name}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink-400)' }}>{s.team_name}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: 'var(--brand-lime)', fontVariantNumeric: 'tabular-nums' }}>{s.goals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* TEAMS */}
      <section className="section" id="teams">
        <div className="container">
          <SectionHead
            eyebrow={`${initialTeams.length} clubs`}
            title="The"
            accent="teams"
            right={<span className="match-meta-text">Tap a team to see the roster</span>}
          />
          {initialTeams.length === 0
            ? <p style={{ color: 'var(--ink-400)', textAlign: 'center', padding: '48px 0' }}>No teams added yet.</p>
            : (
              <Reveal>
                <div className="teams-grid">
                  {initialTeams.map(team => (
                    <TeamCard
                      key={team.id}
                      team={team}
                      standings={standings}
                      tournamentId={tournament.id}
                      cardCount={cardCounts.find(c => c.team_id === team.id) ?? null}
                    />
                  ))}
                </div>
              </Reveal>
            )
          }
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="container footer-inner">
          <div className="brandline">
            <Image src="/logo-mark.svg" alt="" width={24} height={24} />
            <span className="name">Pitch</span>
            <span>Live tournaments, friends &amp; rivals.</span>
          </div>
          {tournament.location && <span style={{ color: 'var(--brand-lime)' }}>{tournament.location}</span>}
        </div>
      </footer>

      {/* ── Match detail modal ── */}
      <MatchModal match={selectedMatch} onClose={() => setSelectedMatchId(null)} />
    </div>
  )
}

function GroupStandings({
  initialTeams,
  matches,
  standings,
  advancePerGroup,
  cardCounts,
}: {
  initialTeams: Array<Team & { players: Player[] }>
  matches: MatchWithTeams[]
  standings: Standing[]
  advancePerGroup: number
  cardCounts: TeamCardCount[]
}) {
  const groups = new Map<string, string[]>()
  for (const t of initialTeams) {
    if (!t.group_label) continue
    const list = groups.get(t.group_label) ?? []
    list.push(t.id)
    groups.set(t.group_label, list)
  }
  const labels = Array.from(groups.keys()).sort()
  const teamLogos = Object.fromEntries(initialTeams.map(t => [t.id, t.logo_path]))

  if (labels.length === 0) {
    return (
      <div className="standings-shell">
        <StandingsTable
          standings={standings}
          matches={matches}
          groupLabel="Unassigned"
          advanceCount={advancePerGroup}
          teamLogos={teamLogos}
          cardCounts={cardCounts}
        />
      </div>
    )
  }

  return (
    <div className={`standings-shell ${labels.length > 1 ? 'multi' : ''}`}>
      {labels.map((label) => {
        const teamIds = new Set(groups.get(label) ?? [])
        const groupStandings = standings.filter((s) => teamIds.has(s.team_id))
        const groupMatches = matches.filter(
          (m) => m.home_team_id !== null && m.away_team_id !== null &&
            teamIds.has(m.home_team_id) && teamIds.has(m.away_team_id),
        )
        return (
          <StandingsTable
            key={label}
            standings={groupStandings}
            matches={groupMatches}
            groupLabel={`Group ${label}`}
            advanceCount={advancePerGroup}
            teamLogos={teamLogos}
            cardCounts={cardCounts}
          />
        )
      })}
    </div>
  )
}
