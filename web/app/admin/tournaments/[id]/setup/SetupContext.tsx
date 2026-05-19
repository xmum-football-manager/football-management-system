'use client'

import { createContext, useContext } from 'react'
import type { Tournament, MatchWithTeams, TeamWithPlayers } from '@/lib/supabase/types'

export interface SetupContextValue {
  tournament: Tournament
  teams: TeamWithPlayers[]
  matches: MatchWithTeams[]
  isAdmin: boolean
  isOrganizer: boolean
  refresh: () => Promise<void>
}

const SetupContext = createContext<SetupContextValue | null>(null)

export function SetupProvider({ value, children }: { value: SetupContextValue; children: React.ReactNode }) {
  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>
}

export function useSetup(): SetupContextValue {
  const ctx = useContext(SetupContext)
  if (!ctx) throw new Error('useSetup must be called inside <SetupProvider>')
  return ctx
}
