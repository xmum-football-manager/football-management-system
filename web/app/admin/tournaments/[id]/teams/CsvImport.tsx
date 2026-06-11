'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Download, Loader2, Upload } from 'lucide-react'
import { parseTeamsCsv, type ParseResult } from './csv-utils'
import { importTeamsAction, type ImportTeamInput } from './actions'

const SAMPLE_CSV = `team,player_name,jersey_number
Team A,John Smith,1
Team A,Jane Doe,5
Team A,Bob Wilson,8
Team A,Alice Chen,10
Team B,Carlos Rivera,1
Team B,Emily Tan,4
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
    reader.onerror = () => {
      toast.error('Could not read the file. Please try again.')
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
          {pending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing… this may take around 1 minute.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
