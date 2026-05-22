import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { NewTournamentForm } from './NewTournamentForm'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'New Tournament' }

export default async function NewTournamentPage() {
  await requireAdmin()
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/admin" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground gap-1 mb-1">
          <ArrowLeft className="h-3 w-3" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">New Tournament</h1>
        <p className="text-sm text-muted-foreground">
          You can rename or change format/points later — until the first match goes live.
        </p>
      </div>
      <Card>
        <CardContent className="p-6">
          <NewTournamentForm />
        </CardContent>
      </Card>
    </div>
  )
}
