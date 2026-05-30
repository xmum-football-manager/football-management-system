# CSV Import for Teams — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV import to the admin Teams tab so organizers can bulk-load teams and players; import is disabled once any team exists.

**Architecture:** A pure TypeScript parsing utility handles CSV text → structured data with validation errors. A client component renders the download-sample button, file picker, preview table, and confirm button. A new server action creates all teams and players in one shot, re-checking for zero teams as a race guard.

**Tech Stack:** Next.js App Router, React (client components), Vitest (unit tests), Supabase (DB), shadcn/ui (Button, Badge), sonner (toasts), lucide-react (icons)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `web/app/admin/tournaments/[id]/teams/csv-utils.ts` | **Create** | Pure CSV parsing + row-level validation |
| `web/__tests__/csv-utils.test.ts` | **Create** | Vitest unit tests for csv-utils |
| `web/app/admin/tournaments/[id]/teams/actions.ts` | **Modify** | Add `importTeamsAction` server action |
| `web/app/admin/tournaments/[id]/teams/CsvImport.tsx` | **Create** | Client component: sample download, file picker, preview, confirm |
| `web/app/admin/tournaments/[id]/teams/TeamsPanel.tsx` | **Modify** | Mount `CsvImport` in the edit section |

---

## Task 1: CSV parsing utility

**Files:**
- Create: `web/app/admin/tournaments/[id]/teams/csv-utils.ts`

- [ ] **Step 1.1: Create the file**

```ts
// web/app/admin/tournaments/[id]/teams/csv-utils.ts

export interface ParsedPlayer {
  player_name: string
  jersey_number: number | null
  position: string | null
}

export interface ParsedTeam {
  name: string
  players: ParsedPlayer[]
}

export interface ParseResult {
  teams: ParsedTeam[]
  errors: string[]
}

const VALID_POSITIONS = new Set(['GK', 'DEF', 'MID', 'FWD'])

export function parseTeamsCsv(csvText: string): ParseResult {
  const lines = csvText.trim().split(/\r?\n/)
  const errors: string[] = []

  if (lines.length < 2) {
    return { teams: [], errors: ['CSV must have a header row and at least one data row.'] }
  }

  const header = lines[0].trim().toLowerCase().split(',')
  const teamIdx = header.indexOf('team')
  const playerIdx = header.indexOf('player_name')
  const jerseyIdx = header.indexOf('jersey_number')
  const posIdx = header.indexOf('position')

  if (teamIdx === -1 || playerIdx === -1) {
    return { teams: [], errors: ['CSV must have "team" and "player_name" columns.'] }
  }

  const teamMap = new Map<string, ParsedPlayer[]>()
  const teamOrder: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const row = i + 1
    const cols = lines[i].split(',')

    const teamName = cols[teamIdx]?.trim() ?? ''
    const playerName = cols[playerIdx]?.trim() ?? ''
    const jerseyRaw = jerseyIdx !== -1 ? (cols[jerseyIdx]?.trim() ?? '') : ''
    const posRaw = posIdx !== -1 ? (cols[posIdx]?.trim().toUpperCase() ?? '') : ''

    if (!teamName) { errors.push(`Row ${row}: "team" is required.`); continue }
    if (!playerName) { errors.push(`Row ${row}: "player_name" is required.`); continue }

    let jerseyNumber: number | null = null
    if (jerseyRaw !== '') {
      const n = Number(jerseyRaw)
      if (!Number.isInteger(n) || n < 0 || n > 99) {
        errors.push(`Row ${row}: jersey_number must be an integer 0–99.`)
        continue
      }
      jerseyNumber = n
    }

    let position: string | null = null
    if (posRaw !== '') {
      if (!VALID_POSITIONS.has(posRaw)) {
        errors.push(`Row ${row}: position must be one of GK, DEF, MID, FWD.`)
        continue
      }
      position = posRaw
    }

    if (!teamMap.has(teamName)) {
      teamMap.set(teamName, [])
      teamOrder.push(teamName)
    }
    teamMap.get(teamName)!.push({ player_name: playerName, jersey_number: jerseyNumber, position })
  }

  const teams = teamOrder.map((name) => ({ name, players: teamMap.get(name)! }))
  return { teams, errors }
}
```

- [ ] **Step 1.2: Commit**

```bash
git add web/app/admin/tournaments/[id]/teams/csv-utils.ts
git commit -m "feat: add CSV parsing utility for teams import"
```

---

## Task 2: Unit tests for csv-utils

**Files:**
- Create: `web/__tests__/csv-utils.test.ts`

- [ ] **Step 2.1: Write the tests**

```ts
// web/__tests__/csv-utils.test.ts
import { describe, it, expect } from 'vitest'
import { parseTeamsCsv } from '@/app/admin/tournaments/[id]/teams/csv-utils'

describe('parseTeamsCsv', () => {
  it('parses a valid CSV into teams and players', () => {
    const csv = `team,player_name,jersey_number,position
Team A,John Smith,1,GK
Team A,Jane Doe,5,DEF
Team B,Bob Wilson,10,MID`
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    expect(teams).toHaveLength(2)
    expect(teams[0].name).toBe('Team A')
    expect(teams[0].players).toHaveLength(2)
    expect(teams[0].players[0]).toEqual({ player_name: 'John Smith', jersey_number: 1, position: 'GK' })
    expect(teams[1].name).toBe('Team B')
    expect(teams[1].players[0]).toEqual({ player_name: 'Bob Wilson', jersey_number: 10, position: 'MID' })
  })

  it('treats optional jersey_number and position as null when empty', () => {
    const csv = `team,player_name,jersey_number,position
Team A,Alice,,`
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    expect(teams[0].players[0]).toEqual({ player_name: 'Alice', jersey_number: null, position: null })
  })

  it('returns error when CSV has fewer than 2 lines', () => {
    const { errors } = parseTeamsCsv('team,player_name')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/header row/)
  })

  it('returns error when required columns are missing', () => {
    const { errors } = parseTeamsCsv(`player_name,jersey_number\nJohn,1`)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/"team"/)
  })

  it('returns row-level error for missing team name', () => {
    const csv = `team,player_name\n,John Smith`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2.*team/)
  })

  it('returns row-level error for missing player name', () => {
    const csv = `team,player_name\nTeam A,`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2.*player_name/)
  })

  it('returns row-level error for jersey_number out of range', () => {
    const csv = `team,player_name,jersey_number\nTeam A,John,100`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2.*jersey_number/)
  })

  it('returns row-level error for non-integer jersey_number', () => {
    const csv = `team,player_name,jersey_number\nTeam A,John,abc`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2.*jersey_number/)
  })

  it('returns row-level error for invalid position', () => {
    const csv = `team,player_name,position\nTeam A,John,STRIKER`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2.*position/)
  })

  it('accepts position values case-insensitively', () => {
    const csv = `team,player_name,position\nTeam A,John,gk`
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    expect(teams[0].players[0].position).toBe('GK')
  })

  it('preserves team insertion order', () => {
    const csv = `team,player_name\nZebra FC,Alice\nAlpha FC,Bob`
    const { teams } = parseTeamsCsv(csv)
    expect(teams[0].name).toBe('Zebra FC')
    expect(teams[1].name).toBe('Alpha FC')
  })

  it('collects multiple errors across rows', () => {
    const csv = `team,player_name,position\n,John,GK\nTeam A,,DEF\nTeam A,Bob,BAD`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(3)
  })

  it('handles Windows-style line endings (CRLF)', () => {
    const csv = `team,player_name\r\nTeam A,John\r\nTeam A,Jane`
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    expect(teams[0].players).toHaveLength(2)
  })
})
```

- [ ] **Step 2.2: Run the tests and verify they pass**

```bash
cd web && pnpm test csv-utils
```

Expected: all 12 tests pass.

- [ ] **Step 2.3: Commit**

```bash
git add web/__tests__/csv-utils.test.ts
git commit -m "test: add unit tests for CSV parsing utility"
```

---

## Task 3: `importTeamsAction` server action

**Files:**
- Modify: `web/app/admin/tournaments/[id]/teams/actions.ts`

- [ ] **Step 3.1: Add the import types and action**

Add to the **top** of the file (after existing imports), add the new import:

```ts
import { listTeams, createTeam } from '@/lib/db/teams'
```

> Note: `createTeam`, `createPlayer`, `revalidatePath`, and `ensureOrganizer` are already in the file. Only `listTeams` needs to be added to the import — check if it's already imported before adding.

Then add these types and the new action at the **bottom** of `actions.ts`:

```ts
export interface ImportPlayerInput {
  name: string
  jersey_number: number | null
  position: string | null
}

export interface ImportTeamInput {
  name: string
  players: ImportPlayerInput[]
}

export async function importTeamsAction(
  tournamentId: string,
  teams: ImportTeamInput[],
): Promise<{ ok: true; teamCount: number; playerCount: number } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const existing = await listTeams(tournamentId)
    if (existing.length > 0) {
      return { error: 'Teams already exist. Import is only available when the tournament has no teams.' }
    }
    let playerCount = 0
    for (const team of teams) {
      const teamResult = await createTeam(tournamentId, team.name)
      if ('error' in teamResult) return { error: `Failed to create team "${team.name}": ${teamResult.error}` }
      for (const player of team.players) {
        const playerResult = await createPlayer({
          team_id: teamResult.id,
          name: player.name,
          jersey_number: player.jersey_number,
          position: player.position,
        })
        if ('error' in playerResult) return { error: `Failed to add player "${player.name}": ${playerResult.error}` }
        playerCount++
      }
    }
    revalidatePath(`/admin/tournaments/${tournamentId}/teams`)
    return { ok: true, teamCount: teams.length, playerCount }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Import failed.' }
  }
}
```

- [ ] **Step 3.2: Verify typecheck passes**

```bash
cd web && pnpm tsc --noEmit 2>&1 | grep -E "actions.ts|error"
```

Expected: no errors on `actions.ts`.

- [ ] **Step 3.3: Commit**

```bash
git add web/app/admin/tournaments/[id]/teams/actions.ts
git commit -m "feat: add importTeamsAction server action for CSV bulk import"
```

---

## Task 4: CsvImport client component

**Files:**
- Create: `web/app/admin/tournaments/[id]/teams/CsvImport.tsx`

- [ ] **Step 4.1: Create the component**

```tsx
// web/app/admin/tournaments/[id]/teams/CsvImport.tsx
'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Download, Upload } from 'lucide-react'
import { parseTeamsCsv, type ParseResult } from './csv-utils'
import { importTeamsAction, type ImportTeamInput } from './actions'

const SAMPLE_CSV = `team,player_name,jersey_number,position
Team A,John Smith,1,GK
Team A,Jane Doe,5,DEF
Team A,Bob Wilson,8,MID
Team A,Alice Chen,10,FWD
Team B,Carlos Rivera,1,GK
Team B,Emily Tan,4,DEF
`

interface Props {
  tournamentId: string
  disabled: boolean
}

export function CsvImport({ tournamentId, disabled }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ParseResult | null>(null)
  const [pending, startTransition] = useTransition()

  function handleDownloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'teams-sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setPreview(parseTeamsCsv(text))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleConfirm() {
    if (!preview || preview.errors.length > 0 || preview.teams.length === 0) return
    const payload: ImportTeamInput[] = preview.teams.map((t) => ({
      name: t.name,
      players: t.players.map((p) => ({
        name: p.player_name,
        jersey_number: p.jersey_number,
        position: p.position,
      })),
    }))
    startTransition(async () => {
      const result = await importTeamsAction(tournamentId, payload)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`${result.teamCount} team${result.teamCount !== 1 ? 's' : ''} and ${result.playerCount} player${result.playerCount !== 1 ? 's' : ''} imported.`)
        setPreview(null)
        router.refresh()
      }
    })
  }

  const totalPlayers = preview?.teams.reduce((s, t) => s + t.players.length, 0) ?? 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-start">
        <Button type="button" variant="outline" size="sm" onClick={handleDownloadSample}>
          <Download className="h-4 w-4" />
          Download Sample CSV
        </Button>
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          {disabled && (
            <p className="text-xs text-muted-foreground">
              Import only available when no teams have been added yet
            </p>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {preview && (
        <div className="rounded-md border p-4 space-y-3">
          <div className="text-sm font-medium">
            Preview: {preview.teams.length} team{preview.teams.length !== 1 ? 's' : ''},{' '}
            {totalPlayers} player{totalPlayers !== 1 ? 's' : ''}
          </div>

          {preview.errors.length > 0 && (
            <ul className="space-y-1">
              {preview.errors.map((err, i) => (
                <li key={i} className="text-xs text-red-600">{err}</li>
              ))}
            </ul>
          )}

          {preview.teams.length > 0 && (
            <div className="space-y-2">
              {preview.teams.map((team) => (
                <div key={team.name}>
                  <div className="text-sm font-medium">
                    {team.name}
                    <span className="text-muted-foreground font-normal ml-2">
                      {team.players.length} player{team.players.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ul className="ml-4 mt-0.5 space-y-0.5">
                    {team.players.map((p, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        {p.jersey_number != null ? `#${p.jersey_number} ` : ''}{p.player_name}
                        {p.position ? ` · ${p.position}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              disabled={preview.errors.length > 0 || preview.teams.length === 0 || pending}
              onClick={handleConfirm}
            >
              Confirm Import
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setPreview(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4.2: Verify typecheck passes**

```bash
cd web && pnpm tsc --noEmit 2>&1 | grep -E "CsvImport.tsx|error"
```

Expected: no errors on `CsvImport.tsx`.

- [ ] **Step 4.3: Commit**

```bash
git add web/app/admin/tournaments/[id]/teams/CsvImport.tsx
git commit -m "feat: add CsvImport client component with preview and confirm flow"
```

---

## Task 5: Wire CsvImport into TeamsPanel

**Files:**
- Modify: `web/app/admin/tournaments/[id]/teams/TeamsPanel.tsx`

- [ ] **Step 5.1: Add the import and mount the component**

Add `CsvImport` to the imports at the top of `TeamsPanel.tsx`:

```ts
import { CsvImport } from './CsvImport'
```

Then in the `TeamsPanel` function body, find the `{canEdit && (...add team card...)}` block (currently at line ~124) and add the `CsvImport` card **above** it:

```tsx
{canEdit && (
  <Card>
    <CardContent className="p-4">
      <CsvImport
        tournamentId={tournamentId}
        disabled={initialTeams.length > 0}
      />
    </CardContent>
  </Card>
)}
```

The full `canEdit` section after the change should look like:

```tsx
{canEdit && (
  <Card>
    <CardContent className="p-4">
      <CsvImport
        tournamentId={tournamentId}
        disabled={initialTeams.length > 0}
      />
    </CardContent>
  </Card>
)}

{canEdit && (
  <Card>
    <CardContent className="p-4">
      <form onSubmit={handleAddTeam} className="flex gap-2">
        {/* ... existing add team form unchanged ... */}
      </form>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 5.2: Run typecheck and tests**

```bash
cd web && pnpm tsc --noEmit && pnpm test
```

Expected: no type errors, all tests pass.

- [ ] **Step 5.3: Commit**

```bash
git add web/app/admin/tournaments/[id]/teams/TeamsPanel.tsx
git commit -m "feat: integrate CSV import into Teams tab"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|-----------------|------|
| CSV format with 4 columns | Task 1 (csv-utils) |
| `team` + `player_name` required | Task 1 + Task 2 (tests) |
| `jersey_number` 0–99 if provided | Task 1 + Task 2 |
| `position` one of GK/DEF/MID/FWD if provided | Task 1 + Task 2 |
| Download Sample CSV button | Task 4 (CsvImport) |
| Import CSV button — disabled when teams exist | Task 4 + Task 5 |
| Disabled state shows explanatory text | Task 4 |
| Preview shows team/player counts | Task 4 |
| Preview shows per-team player list | Task 4 |
| Validation errors block confirm | Task 4 |
| Single server action creates all teams + players | Task 3 |
| Race condition guard (re-check zero teams) | Task 3 |
| Success toast with counts | Task 4 |
| Page refresh after import | Task 4 |
