import { notFound } from 'next/navigation'
import { getMatchByToken } from './actions'
import { createServiceClient } from '@/lib/supabase/server'
import { TokenScoreCard } from './TokenScoreCard'

export default async function PublicScorePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const match = await getMatchByToken(token)
  if (!match) notFound()

  const svc = createServiceClient()
  const [{ data: homePlayers }, { data: awayPlayers }, { data: goals }, { data: cards }] = await Promise.all([
    svc.from('players').select('*').eq('team_id', match.home_team_id ?? '').order('jersey_number'),
    svc.from('players').select('*').eq('team_id', match.away_team_id ?? '').order('jersey_number'),
    svc.from('goals').select('*').eq('match_id', match.id).order('created_at', { ascending: false }),
    svc.from('cards').select('*').eq('match_id', match.id).order('created_at', { ascending: false }),
  ])

  return (
    <div className="min-h-screen bg-background p-4">
      <TokenScoreCard
        match={match}
        token={token}
        homePlayers={homePlayers ?? []}
        awayPlayers={awayPlayers ?? []}
        initialGoals={goals ?? []}
        initialCards={cards ?? []}
      />
    </div>
  )
}
