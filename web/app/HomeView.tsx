'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { withTeamFallback } from '@/lib/match-teams'
import { mediaUrl } from '@/lib/storage'
import { teamColor, teamCode } from '@/lib/team-style'
import {
  buildTicker,
  formatDateRange,
  formatLabel,
  homeStats,
  homeStatus,
  isLiveMatch,
  startsIn,
  tournamentAccent,
  tournamentChampion,
  type HomeStatus,
} from '@/lib/home-utils'
import { MY_TZ } from '@/lib/tz'
import type { Tournament, Team, MatchWithTeams, Standing } from '@/lib/supabase/types'

const ORG = 'XMUM Football Club'
const SEASON = `${new Date().getFullYear()} Season`

// ── Small shared bits ────────────────────────────────────────────────────────

/** Reveal-on-scroll: adds .in when the element first enters the viewport. */
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLAnchorElement>(null)
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
    }, { threshold })
    io.observe(el)
    // safety: never leave content hidden
    const t = setTimeout(() => el.classList.add('in'), 2500)
    return () => { clearTimeout(t); io.disconnect() }
  }, [threshold])
  return ref
}

function liveMinute(startedAt: string | null, now: number) {
  if (!startedAt) return 0
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000))
}

function matchClock(m: MatchWithTeams, now: number) {
  return m.status === 'halftime' ? 'HT' : `${liveMinute(m.match_started_at, now)}'`
}

/** Round team crest — logo image when uploaded, colored initials otherwise. */
function Crest({ team }: { team: Team }) {
  const logo = mediaUrl(team.logo_path)
  return (
    <span className="crest" style={logo ? undefined : { background: teamColor(team.id) }}>
      {logo ? <img src={logo} alt={team.name} /> : teamCode(team.name)}
    </span>
  )
}

const IconArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></svg>
)
const IconCalendar = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
)
const IconTeams = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
)
const IconPin = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
)
const IconStage = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>
)

// ── Per-tournament card data ─────────────────────────────────────────────────

interface CardData {
  t: Tournament
  status: HomeStatus
  accent: string
  bannerUrl: string | null
  logoUrl: string | null
  teamsCount: number
  liveMatches: MatchWithTeams[]
  nextMatch: MatchWithTeams | null
  progress: string | null
  champion: { team: Team; note: string } | null
}

const STATUS_ORDER: Record<HomeStatus, number> = { live: 0, active: 1, upcoming: 2, finished: 3 }

function buildCards(
  tournaments: Tournament[],
  matches: MatchWithTeams[],
  teams: Team[],
  standings: Standing[],
): CardData[] {
  const now = Date.now()
  return tournaments
    .map((t) => {
      const ms = matches.filter((m) => m.tournament_id === t.id)
      const status = homeStatus(t, matches)
      const finished = ms.filter((m) => m.status === 'finished').length
      const scheduled = ms
        .filter((m) => m.status === 'scheduled' && m.match_time && new Date(m.match_time).getTime() > now)
        .sort((a, b) => new Date(a.match_time!).getTime() - new Date(b.match_time!).getTime())
      return {
        t,
        status,
        accent: tournamentAccent(t.id),
        bannerUrl: mediaUrl(t.banner_path),
        logoUrl: mediaUrl(t.logo_path),
        teamsCount: teams.filter((tm) => tm.tournament_id === t.id).length,
        liveMatches: ms.filter(isLiveMatch),
        nextMatch: scheduled[0] ?? null,
        progress: status === 'live' || status === 'active' ? `${finished} of ${ms.length} matches played` : null,
        champion: tournamentChampion(t, matches, standings, teams),
      }
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.t.start_date.localeCompare(a.t.start_date))
}

// ── Top nav ──────────────────────────────────────────────────────────────────

const HomeNav = () => (
  <header className="topnav">
    <div className="topnav-inner">
      <div className="topnav-brand">
        <img src="/logo-mark.svg" alt="Pitch" />
        <span className="name">Pitch</span>
        <span className="topnav-tourney">{ORG} · <span style={{ color: 'var(--brand-lime)' }}>{SEASON}</span></span>
      </div>
    </div>
  </header>
)

// ── Hero live panel ──────────────────────────────────────────────────────────

function HeroLivePanel({ cards, now }: { cards: CardData[]; now: number }) {
  const live = cards.flatMap((c) =>
    c.liveMatches.map((m) => ({ m, name: c.t.name, accent: c.accent, href: `/t/${c.t.id}` })),
  )

  if (live.length > 0) {
    return (
      <aside className="home-hero-aside">
        <div className="live-panel">
          <div className="live-panel-head">
            <span className="lph-title"><span className="live-dot" />Live now</span>
            <span className="lph-count">{live.length} {live.length === 1 ? 'match' : 'matches'}</span>
          </div>
          <div className="live-panel-body">
            {live.map(({ m, name, accent, href }) => (
              <Link className="lp-match" href={href} key={m.id} style={{ '--lp-accent': accent } as React.CSSProperties}>
                <div className="lp-tourney">{name}</div>
                <div className="lp-score-row">
                  <div className="lp-team home"><Crest team={m.home_team} /></div>
                  <div className="lp-score">
                    <span className="sc" key={`h${m.home_score}`}>{m.home_score}</span>
                    <span className="dash">–</span>
                    <span className="sc" key={`a${m.away_score}`}>{m.away_score}</span>
                  </div>
                  <div className="lp-team away"><Crest team={m.away_team} /></div>
                </div>
                <div className="lp-min"><span className="ball" /><span suppressHydrationWarning>{matchClock(m, now)}</span></div>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    )
  }

  // No live matches → up next (or latest results)
  const upcoming = cards.filter((c) => c.status === 'upcoming' || c.status === 'active')
  const finished = cards.filter((c) => c.status === 'finished' && c.champion)
  const showUpcoming = upcoming.length > 0
  const rows = (showUpcoming ? upcoming : finished).slice(0, 3)

  return (
    <aside className="home-hero-aside">
      <div className="live-panel">
        <div className="live-panel-head">
          <span className="lph-title"><span className="idle-dot" />{showUpcoming ? 'Up next' : 'Latest results'}</span>
          <span className="lph-count">No matches live</span>
        </div>
        <div className="live-panel-body">
          {rows.map((c) => (
            <Link className="lp-row" href={`/t/${c.t.id}`} key={c.t.id} style={{ '--lp-accent': c.accent } as React.CSSProperties}>
              <div className="lp-row-main">
                <div className="lp-tourney left">{c.t.name}</div>
                <div className="lp-row-sub">{c.teamsCount > 0 ? `${c.teamsCount} teams · ` : ''}{formatLabel(c.t.format)}</div>
              </div>
              {showUpcoming ? (
                <div className="lp-date">
                  <span className="d" suppressHydrationWarning>{formatDateRange(c.nextMatch?.match_time ?? c.t.start_date, null)}</span>
                  <span className="s" suppressHydrationWarning>
                    {c.status === 'active' ? 'In progress' : startsIn(c.t.start_date).replace('Starts ', '')}
                  </span>
                </div>
              ) : (
                <div className="lp-result">
                  <span className="winner">{c.champion!.team.name}</span>
                  <Crest team={c.champion!.team} />
                </div>
              )}
            </Link>
          ))}
          {rows.length === 0 && (
            <div className="lp-empty">
              <img src="/icon-whistle.svg" alt="" />
              <span>No fixtures scheduled yet.<br />Check back soon.</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function HomeHero({ cards, matches, teams, now, onJump }: {
  cards: CardData[]
  matches: MatchWithTeams[]
  teams: Team[]
  now: number
  onJump: (filter: HomeStatus | 'all') => void
}) {
  const liveCount = cards.filter((c) => c.status === 'live').length
  const upcomingCount = cards.filter((c) => c.status === 'upcoming').length
  const hasLive = liveCount > 0

  const stats = useMemo(
    () => homeStats(cards.map((c) => c.t), matches, teams),
    [cards, matches, teams],
  )
  const [counts, setCounts] = useState({ tournaments: 0, teams: 0, matchesToday: 0, goalsThisWeek: 0 })

  useEffect(() => {
    const dur = 900
    const start = performance.now()
    let raf: number
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const ease = 1 - Math.pow(1 - p, 3)
      setCounts({
        tournaments: Math.round(stats.tournaments * ease),
        teams: Math.round(stats.teams * ease),
        matchesToday: Math.round(stats.matchesToday * ease),
        goalsThisWeek: Math.round(stats.goalsThisWeek * ease),
      })
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [stats])

  return (
    <section className="home-hero">
      <div className="home-hero-inner">
        <div className="home-hero-main">
          <span className={`kicker ${hasLive ? '' : 'idle'}`}>
            <span className={hasLive ? 'live-dot' : 'idle-dot'} />
            {hasLive
              ? `${liveCount} ${liveCount === 1 ? 'tournament' : 'tournaments'} live right now`
              : upcomingCount > 0
                ? `No live matches — ${upcomingCount} ${upcomingCount === 1 ? 'tournament' : 'tournaments'} coming up`
                : 'Season schedule'}
          </span>
          <h1>Every match.<br /><span className="accent">One campus.</span></h1>
          <p className="lede">
            Live scores, standings, rosters and brackets for every tournament at XMUM — updated in real time as the whistle blows.
          </p>
          <div className="hero-cta">
            <button className="btn btn-lime btn-lg" onClick={() => onJump('all')}>
              Browse tournaments
              <IconArrow />
            </button>
            {hasLive ? (
              <button className="btn btn-lg" onClick={() => onJump('live')}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--red-card)', display: 'inline-block', animation: 'pitchPulse 1.6s infinite' }} />
                Watch live now
              </button>
            ) : (
              <button className="btn btn-lg" onClick={() => onJump(upcomingCount > 0 ? 'upcoming' : 'all')}>
                <IconCalendar />
                {upcomingCount > 0 ? "See what's coming up" : 'See the schedule'}
              </button>
            )}
          </div>

          <div className="home-stats">
            <div className="home-stat"><div className="v">{counts.tournaments}</div><div className="l">Active tournaments</div></div>
            <div className="home-stat"><div className="v">{counts.teams}</div><div className="l">Teams competing</div></div>
            <div className="home-stat"><div className="v">{counts.matchesToday}</div><div className="l">Matches today</div></div>
            <div className="home-stat"><div className="v">{counts.goalsThisWeek}</div><div className="l">Goals this week</div></div>
          </div>
        </div>
        <HeroLivePanel cards={cards} now={now} />
      </div>
    </section>
  )
}

// ── Ticker ───────────────────────────────────────────────────────────────────

function HomeTicker({ tournaments, matches }: { tournaments: Tournament[]; matches: MatchWithTeams[] }) {
  const feed = useMemo(() => buildTicker(tournaments, matches), [tournaments, matches])
  if (feed.length === 0) return null
  const items = [...feed, ...feed] // doubled for the seamless marquee loop
  return (
    <div className="home-ticker">
      <div className="home-ticker-track">
        {items.map((it, i) => (
          <span className="home-ticker-item" key={i} suppressHydrationWarning>
            <span className="tag">{it.tag}</span>
            <span>{it.text}</span>
            <span className="home-ticker-sep" />
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Tournament card ──────────────────────────────────────────────────────────

function TournamentCard({ c, idx, now }: { c: CardData; idx: number; now: number }) {
  const ref = useInView()
  const { t } = c
  const featured = c.liveMatches[0] ?? null

  const badge =
    c.status === 'live' ? (
      <span className="badge live"><span className="dot" />Live · {c.liveMatches.length} {c.liveMatches.length === 1 ? 'match' : 'matches'}</span>
    ) : c.status === 'active' ? (
      <span className="badge active">In progress</span>
    ) : c.status === 'upcoming' ? (
      <span className="badge upcoming">Upcoming</span>
    ) : (
      <span className="badge finished">Finished</span>
    )

  return (
    <Link
      ref={ref}
      className="tcard"
      href={`/t/${t.id}`}
      style={{ '--tc-accent': c.accent, transitionDelay: `${(idx % 6) * 60}ms` } as React.CSSProperties}
    >
      <div className="accent-strip" />

      {/* Banner media — uploaded tournament banner, or accent fallback */}
      <div className="tcard-banner">
        {c.bannerUrl ? <img src={c.bannerUrl} alt="" loading="lazy" /> : <div className="tcard-banner-fallback" />}
        <div className="tcard-top">
          {badge}
          <span className="sport-tag">{t.min_players_per_team}-a-side</span>
        </div>
        <span className="tcard-crest">
          {c.logoUrl ? <img src={c.logoUrl} alt="" loading="lazy" /> : teamCode(t.name)}
        </span>
      </div>

      <div className="tcard-body">
        <div className="tname">{t.name}</div>
        <div className="tedition" suppressHydrationWarning>{formatDateRange(t.start_date, t.end_date)}</div>

        <div className="meta-rows">
          <div className="meta-row"><IconTeams />{c.teamsCount > 0 ? `${c.teamsCount} teams · ` : ''}{formatLabel(t.format)}</div>
          {t.location && <div className="meta-row"><IconPin />{t.location}</div>}
          {c.progress && <div className="meta-row"><IconStage />{c.progress}</div>}
        </div>

        {featured && (
          <div className="live-strip">
            <div className="lt-team home">
              <Crest team={featured.home_team} />
              <span className="nm">{featured.home_team.name}</span>
            </div>
            <div className="lt-score">
              <span className="sc">{featured.home_score}–{featured.away_score}</span>
              <span className="min" suppressHydrationWarning>{matchClock(featured, now)}</span>
            </div>
            <div className="lt-team away">
              <Crest team={featured.away_team} />
              <span className="nm">{featured.away_team.name}</span>
            </div>
          </div>
        )}

        {c.status === 'upcoming' && (
          <div className="upcoming-strip">
            <span className="when" suppressHydrationWarning>{startsIn(t.start_date)}</span>
            <span className="date" suppressHydrationWarning>{formatDateRange(t.start_date, null)}</span>
          </div>
        )}

        {c.status === 'active' && !featured && c.nextMatch?.match_time && (
          <div className="upcoming-strip">
            <span className="when">Next match</span>
            <span className="date" suppressHydrationWarning>
              {new Date(c.nextMatch.match_time).toLocaleString('en-MY', { timeZone: MY_TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}
            </span>
          </div>
        )}

        {c.status === 'finished' && c.champion && (
          <div className="champ-strip">
            <img src="/icon-trophy.svg" alt="" />
            <div className="ct">
              <span className="lbl">Champion · {c.champion.note}</span>
              <span className="nm">{c.champion.team.name}</span>
            </div>
            <Crest team={c.champion.team} />
          </div>
        )}

        <div className="tcard-footer">
          <span className="open">{c.status === 'finished' ? 'View results' : 'Open live view'}</span>
          <span className="arrow"><IconArrow /></span>
        </div>
      </div>
    </Link>
  )
}

// ── Tournaments section ──────────────────────────────────────────────────────

const FILTERS: { id: HomeStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live now' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'finished', label: 'Finished' },
]

function TournamentsSection({ cards, filter, setFilter, now }: {
  cards: CardData[]
  filter: HomeStatus | 'all'
  setFilter: (f: HomeStatus | 'all') => void
  now: number
}) {
  const list = cards.filter((c) => filter === 'all' || c.status === filter)
  return (
    <section className="home-section" id="tournaments">
      <div className="container">
        <div className="home-section-head">
          <div>
            <span className="eyebrow">{SEASON}</span>
            <h2>The <span className="accent">tournaments</span></h2>
          </div>
          <div className="home-filters">
            {FILTERS.map((f) => (
              <button key={f.id} className={`home-filter ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {list.length > 0 ? (
          <div className="tournaments-grid">
            {list.map((c, i) => <TournamentCard key={c.t.id} c={c} idx={i} now={now} />)}
          </div>
        ) : (
          <div className="tournaments-empty">
            <img src="/icon-whistle.svg" alt="" />
            <div className="te-title">No {filter === 'all' ? '' : filter === 'live' ? 'live ' : `${filter} `}tournaments</div>
            <p className="te-sub">
              {filter === 'live'
                ? 'Nothing is kicking off right this second. Browse upcoming fixtures or check back at match time.'
                : 'Nothing here right now — try a different filter.'}
            </p>
            {filter !== 'all' && (
              <button className="btn btn-lime" onClick={() => setFilter('all')}>Show all tournaments</button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

// ── CTA band + footer ────────────────────────────────────────────────────────

const CTABand = ({ hasLive, onJump }: { hasLive: boolean; onJump: (f: HomeStatus | 'all') => void }) => (
  <section className="home-cta-band">
    <div className="home-cta-inner">
      <div>
        <h2>Never miss a goal.</h2>
        <p>Scores update live the moment they happen — keep Pitch open on match day and follow every kick from anywhere on campus.</p>
      </div>
      <button className="btn btn-dark btn-lg" onClick={() => onJump(hasLive ? 'live' : 'all')}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: hasLive ? 'var(--red-card)' : 'var(--brand-lime)', display: 'inline-block', ...(hasLive ? { animation: 'pitchPulse 1.6s infinite' } : {}) }} />
        Watch live now
      </button>
    </div>
  </section>
)

const HomeFooter = () => (
  <footer className="footer">
    <div className="container footer-inner">
      <div className="brandline">
        <img src="/logo-mark.svg" alt="" />
        <span className="name">Pitch</span>
        <span>Live tournaments, friends &amp; rivals.</span>
      </div>
      <div style={{ display: 'flex', gap: 18 }}>
        <span>{ORG}</span>
        <span style={{ color: 'var(--brand-lime)' }}>{SEASON}</span>
      </div>
    </div>
  </footer>
)

// ── Page root ────────────────────────────────────────────────────────────────

interface HomeViewProps {
  tournaments: Tournament[]
  initialMatches: MatchWithTeams[]
  teams: Team[]
  standings: Standing[]
  /** false in mock-data mode — disables the realtime subscription */
  liveSync: boolean
}

export function HomeView({ tournaments, initialMatches, teams, standings, liveSync }: HomeViewProps) {
  const [matches, setMatches] = useState(initialMatches)
  const [filter, setFilter] = useState<HomeStatus | 'all'>('all')
  // clock for live-minute displays; ticks only while matches are live
  const [now, setNow] = useState(() => Date.now())

  const cards = useMemo(() => buildCards(tournaments, matches, teams, standings), [tournaments, matches, teams, standings])
  const hasLive = matches.some(isLiveMatch)

  const refetch = useCallback(async () => {
    if (!liveSync || tournaments.length === 0) return
    const supabase = createClient()
    const { data } = await supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .in('tournament_id', tournaments.map((t) => t.id))
      .order('match_time', { ascending: true })
    if (data) setMatches(withTeamFallback(data as MatchWithTeams[]))
  }, [liveSync, tournaments])

  // Realtime score sync — same pattern as TournamentView, across all listed tournaments
  useEffect(() => {
    if (!liveSync) return
    const supabase = createClient()
    let fallbackInterval: ReturnType<typeof setInterval> | null = null
    const channel = supabase.channel('home-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => refetch())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && fallbackInterval) { clearInterval(fallbackInterval); fallbackInterval = null }
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !fallbackInterval) {
          fallbackInterval = setInterval(refetch, 30000)
        }
      })
    return () => { supabase.removeChannel(channel); if (fallbackInterval) clearInterval(fallbackInterval) }
  }, [liveSync, refetch])

  useEffect(() => {
    const handler = () => { if (!document.hidden) refetch() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [refetch])

  useEffect(() => {
    if (!hasLive) return
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [hasLive])

  const jumpTo = useCallback((f: HomeStatus | 'all') => {
    setFilter(f)
    const el = document.getElementById('tournaments')
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: 'smooth' })
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-900)', color: 'var(--ink-50)' }}>
      <HomeNav />
      <HomeHero cards={cards} matches={matches} teams={teams} now={now} onJump={jumpTo} />
      <HomeTicker tournaments={tournaments} matches={matches} />
      <TournamentsSection cards={cards} filter={filter} setFilter={setFilter} now={now} />
      <CTABand hasLive={hasLive} onJump={jumpTo} />
      <HomeFooter />
    </div>
  )
}
