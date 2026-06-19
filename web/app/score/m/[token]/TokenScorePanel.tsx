'use client'

import { ScorePanel, type ScoreActions } from '../../ScorePanel'
import {
  tokenRecordGoal,
  tokenDeleteGoal,
  tokenAddCard,
  tokenTransitionMatch,
  tokenSetKnockoutWinner,
} from './actions'
import type { MatchWithTeams, Player, Goal, Card } from '@/lib/supabase/types'

interface Props {
  match: MatchWithTeams
  token: string
  homePlayers: Player[]
  awayPlayers: Player[]
  initialGoals: Goal[]
  initialCards: Card[]
}

// Token (no-account) scorekeeper actions for one match, bound to the shared
// panel's action contract.
function tokenActions(token: string): ScoreActions {
  return {
    recordGoal: (teamId, playerId) => tokenRecordGoal(token, teamId, playerId),
    deleteGoal: (goalId) => tokenDeleteGoal(token, goalId),
    addCard: (playerId, cardType) => tokenAddCard(token, playerId, cardType),
    transition: (next) => tokenTransitionMatch(token, next),
    setKnockoutWinner: (teamId) => tokenSetKnockoutWinner(token, teamId),
  }
}

export function TokenScorePanel({ match, token, homePlayers, awayPlayers, initialGoals, initialCards }: Props) {
  return (
    <ScorePanel
      match={match}
      actions={tokenActions(token)}
      initialHomePlayers={homePlayers}
      initialAwayPlayers={awayPlayers}
      initialGoals={initialGoals}
      initialCards={initialCards}
    />
  )
}
