'use client'

import { useState, useTransition, useRef } from 'react'
import { toast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { createTeamsBatch } from '@/lib/db/teams'
import { createPlayersBatch } from '@/lib/db/players'
import type { TeamWithPlayers } from '@/lib/supabase/types'

interface CsvRow {
  team_name: string
  player_name: string
  jersey_number: string
  position: string
}

interface ParsedResult {
  teams: Map<string, string[]>  // team_name -> player_names[]
  rows: CsvRow[]
  errors: string[]
}

function parseCsv(text: string): ParsedResult {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return { teams: new Map(), rows: [], errors: ['CSV file is empty or has no data rows.'] }

  const header = lines[0].toLowerCase().split(',').map(h => h.trim())
  const teamIdx = header.indexOf('team_name')
  const playerIdx = header.indexOf('player_name')
  const jerseyIdx = header.indexOf('jersey_number')
  const posIdx = header.indexOf('position')

  if (teamIdx === -1) return { teams: new Map(), rows: [], errors: ['Missing required column: team_name'] }
  if (playerIdx === -1) return { teams: new Map(), rows: [], errors: ['Missing required column: player_name'] }

  const errors: string[] = []
  const rows: CsvRow[] = []
  const teams = new Map<string, string[]>()

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    const team = cols[teamIdx] ?? ''
    const player = cols[playerIdx] ?? ''
    const jersey = jerseyIdx !== -1 ? (cols[jerseyIdx] ?? '') : ''
    const pos = posIdx !== -1 ? (cols[posIdx] ?? '') : ''

    if (!team) { errors.push(`Row ${i + 1}: team_name is empty`); continue }
    if (!player) { errors.push(`Row ${i + 1}: player_name is empty`); continue }

    if (jersey && (isNaN(Number(jersey)) || Number(jersey) < 1 || Number(jersey) > 99)) {
      errors.push(`Row ${i + 1}: invalid jersey_number "${jersey}" (must be 1-99)`)
      continue
    }

    rows.push({ team_name: team, player_name: player, jersey_number: jersey, position: pos })
    if (!teams.has(team)) teams.set(team, [])
    teams.get(team)!.push(player)
  }

  return { teams, rows, errors }
}

interface Props {
  tournamentId: string
  existingTeams: TeamWithPlayers[]
  disabled: boolean
  onRefresh: () => void
}

export function CsvImport({ tournamentId, existingTeams, disabled, onRefresh }: Props) {
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = useState<ParsedResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      const result = parseCsv(text)
      setPreview(result)
    }
    reader.readAsText(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  function doImport() {
    if (!preview || preview.rows.length === 0) return
    startTransition(async () => {
      const existingTeamNames = new Set(existingTeams.map(t => t.name))
      const existingPlayersByTeam = new Map<string, Set<string>>()
      for (const t of existingTeams) {
        existingPlayersByTeam.set(t.name, new Set(t.players.map(p => p.name)))
      }

      const uniqueTeamNames = [...preview.teams.keys()]
      const newTeamNames = uniqueTeamNames.filter(n => !existingTeamNames.has(n))
      const skippedTeams = uniqueTeamNames.length - newTeamNames.length

      let createdTeams = 0
      let createdPlayers = 0
      let skippedPlayers = 0

      const teamIdMap = new Map<string, string>()
      for (const t of existingTeams) teamIdMap.set(t.name, t.id)

      if (newTeamNames.length > 0) {
        try {
          const supabase = createClient()
          const insertedTeams = await createTeamsBatch(supabase, tournamentId, newTeamNames)
          createdTeams = insertedTeams.length
          for (const t of insertedTeams) teamIdMap.set(t.name, t.id)
        } catch (err) {
          toast.error(`Failed to create teams: ${err instanceof Error ? err.message : 'unknown error'}`)
          return
        }
      }

      // Build player inserts
      const playerInserts: { team_id: string; name: string; jersey_number: number | null; position: string | null }[] = []
      for (const row of preview.rows) {
        const teamId = teamIdMap.get(row.team_name)
        if (!teamId) continue

        const existingNames = existingPlayersByTeam.get(row.team_name)
        if (existingNames?.has(row.player_name)) { skippedPlayers++; continue }

        playerInserts.push({
          team_id: teamId,
          name: row.player_name,
          jersey_number: row.jersey_number ? Number(row.jersey_number) : null,
          position: row.position || null,
        })

        if (!existingNames) existingPlayersByTeam.set(row.team_name, new Set([row.player_name]))
        else existingNames.add(row.player_name)
      }

      if (playerInserts.length > 0) {
        const { error: playerErr } = await createPlayersBatch(playerInserts)
        if (playerErr) { toast.error(`Failed to create players: ${playerErr.message}`); return }
        createdPlayers = playerInserts.length
      }

      const parts: string[] = []
      if (createdTeams > 0) parts.push(`${createdTeams} team${createdTeams !== 1 ? 's' : ''}`)
      if (createdPlayers > 0) parts.push(`${createdPlayers} player${createdPlayers !== 1 ? 's' : ''}`)
      if (skippedTeams > 0) parts.push(`${skippedTeams} team${skippedTeams !== 1 ? 's' : ''} skipped`)
      if (skippedPlayers > 0) parts.push(`${skippedPlayers} player${skippedPlayers !== 1 ? 's' : ''} skipped`)

      toast.success(`Imported: ${parts.join(', ')}`)
      setPreview(null)
      onRefresh()
    })
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="flex gap-2">
        <a href="/team-import-template.csv" download="team-import-template.csv"
          className="text-slate-600 hover:text-slate-800 text-sm font-medium border border-slate-300 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors">
          Download CSV Template
        </a>
        <label className={`text-sm font-medium px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed border-slate-200 text-slate-400' : 'border-slate-300 text-slate-600 hover:text-slate-800 hover:bg-slate-50'
        }`}>
          Import CSV
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} disabled={disabled} className="hidden" />
        </label>
      </div>

      {preview && (
        <div className={`rounded-xl border p-4 ${preview.errors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          {preview.errors.length > 0 ? (
            <div className="space-y-1 mb-3">
              <p className="text-sm font-semibold text-red-700">Validation errors:</p>
              {preview.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-600">• {err}</p>
              ))}
              <button onClick={() => setPreview(null)} className="text-xs text-red-500 hover:text-red-700 mt-2">Dismiss</button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-900 mb-1">
                Ready to import: <span className="text-green-600 font-bold">{preview.teams.size} team{preview.teams.size !== 1 ? 's' : ''}</span>,{' '}
                <span className="text-green-600 font-bold">{preview.rows.length} player{preview.rows.length !== 1 ? 's' : ''}</span>
              </p>
              <div className="text-xs text-slate-500 mb-3 space-y-0.5">
                {[...preview.teams.entries()].map(([name, players]) => (
                  <p key={name}>{name}: {players.length} player{players.length !== 1 ? 's' : ''}</p>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={doImport} disabled={isPending}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                  {isPending ? 'Importing…' : 'Confirm Import'}
                </button>
                <button onClick={() => setPreview(null)} disabled={isPending}
                  className="text-slate-500 hover:text-slate-700 text-sm px-3 py-2">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
