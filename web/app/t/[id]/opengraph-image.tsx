import { ImageResponse } from 'next/og'
import { createServerClient } from '@supabase/ssr'
import { formatDateRange } from '@/lib/home-utils'
import { loadOgFonts, PitchLogo, PitchBackdrop, OG_SIZE, OG_COLORS } from '@/lib/og'

export const alt = 'Tournament live scores on Pitch'
export const size = OG_SIZE
export const contentType = 'image/png'

interface Props {
  params: Promise<{ id: string }>
}

// Crawlers (WhatsApp, Telegram) have no cookies — use a bare anon client
function anonClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

interface LiveMatch {
  home_score: number
  away_score: number
  status: string
  home_team: { name: string } | null
  away_team: { name: string } | null
}

export default async function Image({ params }: Props) {
  const { id } = await params
  const supabase = anonClient()

  const [{ data: tournament }, { data: live }] = await Promise.all([
    supabase.from('tournaments').select('name, location, start_date, end_date, status').eq('id', id).single(),
    supabase.from('matches')
      .select('home_score, away_score, status, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name)')
      .eq('tournament_id', id)
      .in('status', ['live', 'halftime'])
      .order('match_started_at', { ascending: false })
      .limit(1)
      .maybeSingle<LiveMatch>(),
  ])

  const name = tournament?.name ?? 'Football Tournament'
  const detailLine = tournament
    ? [tournament.location, formatDateRange(tournament.start_date, tournament.end_date)].filter(Boolean).join(' · ')
    : ''
  const nameSize = name.length > 28 ? 64 : name.length > 16 ? 80 : 96

  const teamRow = (teamName: string, score: number) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', width: 760 }}>
      <div style={{
        fontFamily: 'Archivo Narrow', fontSize: 64, fontWeight: 700, color: OG_COLORS.ink,
        textTransform: 'uppercase', letterSpacing: -1,
        maxWidth: 640, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {teamName}
      </div>
      <div style={{ fontFamily: 'Archivo Narrow', fontSize: 64, fontWeight: 700, color: OG_COLORS.lime, display: 'flex' }}>
        {score}
      </div>
    </div>
  )

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '56px 90px 64px',
        background: OG_COLORS.bg, fontFamily: 'Archivo', position: 'relative',
      }}>
        <PitchBackdrop />

        {/* Brand header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <PitchLogo size={52} />
          <div style={{
            fontFamily: 'Archivo Narrow', fontSize: 40, fontWeight: 700,
            color: OG_COLORS.ink, textTransform: 'uppercase', letterSpacing: -1,
          }}>
            Pitch
          </div>
        </div>

        {live ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: OG_COLORS.lime, color: OG_COLORS.bg, borderRadius: 8,
                padding: '8px 18px', fontFamily: 'Archivo Narrow', fontSize: 30, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 1,
              }}>
                <div style={{ width: 12, height: 12, borderRadius: 6, background: OG_COLORS.bg, display: 'flex' }} />
                {live.status === 'halftime' ? 'Half-time' : 'Live'}
              </div>
            </div>
            {teamRow(live.home_team?.name ?? 'TBD', live.home_score)}
            {teamRow(live.away_team?.name ?? 'TBD', live.away_score)}
            <div style={{ marginTop: 10, fontSize: 30, color: OG_COLORS.muted, display: 'flex' }}>
              {name}{detailLine ? ` · ${detailLine}` : ''}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              fontFamily: 'Archivo Narrow', fontSize: 28, fontWeight: 700, color: OG_COLORS.lime,
              textTransform: 'uppercase', letterSpacing: 4, display: 'flex',
            }}>
              {tournament?.status === 'finished' ? 'Final Standings' : 'Football Tournament'}
            </div>
            <div style={{
              fontFamily: 'Archivo Narrow', fontSize: nameSize, fontWeight: 700, color: OG_COLORS.ink,
              textTransform: 'uppercase', letterSpacing: -2, lineHeight: 1.05,
              maxWidth: 880, display: 'flex',
            }}>
              {name}
            </div>
            {detailLine && (
              <div style={{ fontSize: 32, color: OG_COLORS.muted, display: 'flex' }}>
                {detailLine}
              </div>
            )}
          </div>
        )}

        {/* Footer tagline */}
        <div style={{ fontSize: 26, color: OG_COLORS.muted, display: 'flex' }}>
          Live scores, standings & fixtures
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await loadOgFonts() }
  )
}
