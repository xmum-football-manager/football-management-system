'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Wand2 } from 'lucide-react'
import { generateGroupFixturesAction } from '../fixtures/actions'

interface Props {
  tournamentId: string
}

export function GenerateGroupFixturesButton({ tournamentId }: Props) {
  const [pending, startTransition] = useTransition()

  function handleGenerate() {
    startTransition(async () => {
      const r = await generateGroupFixturesAction(tournamentId)
      if ('error' in r) {
        toast.error(r.error)
      } else {
        toast.success(`${r.created} fixture${r.created === 1 ? '' : 's'} generated.`)
      }
    })
  }

  return (
    <Button onClick={handleGenerate} disabled={pending} size="sm">
      <Wand2 className="h-4 w-4 mr-2" />
      {pending ? 'Generating…' : 'Generate fixtures'}
    </Button>
  )
}
