import { redirect } from 'next/navigation'
import { getTournament } from '@/lib/db/tournaments'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FixturesRedirectPage({ params }: Props) {
  const { id } = await params
  const tournament = await getTournament(id)
  if (!tournament) return null

  if (tournament.format === 'knockout') {
    redirect(`/admin/tournaments/${id}/ko-fixtures`)
  }
  redirect(`/admin/tournaments/${id}/rd-fixtures`)
}
