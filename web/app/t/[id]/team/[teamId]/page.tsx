import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface Props {
  params: Promise<{ id: string; teamId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: team } = await supabase.from('teams').select('name').eq('id', teamId).single()
  if (!team) return { title: 'Team Not Found' }
  return { title: `${team.name} — Roster` }
}

export default async function TeamPage({ params }: Props) {
  const { id, teamId } = await params
  const supabase = await createClient()

  const { data: team } = await supabase
    .from('teams')
    .select('*, players(*)')
    .eq('id', teamId)
    .eq('tournament_id', id)
    .single()

  if (!team) notFound()

  const players = [...(team.players ?? [])].sort((a, b) => {
    if (a.jersey_number !== null && b.jersey_number !== null) return a.jersey_number - b.jersey_number
    if (a.jersey_number !== null) return -1
    if (b.jersey_number !== null) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#0f172a] text-white px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <Link href={`/t/${id}`} className="text-slate-400 text-sm hover:text-white">← Back to Tournament</Link>
          <h1 className="text-xl font-bold mt-1">{team.name}</h1>
          <p className="text-slate-400 text-xs mt-0.5">{players.length} player{players.length !== 1 ? 's' : ''}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {players.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">👤</p>
            <p className="text-slate-600 font-medium">No players registered yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide w-12">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Position</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                      {p.jersey_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell capitalize">
                      {p.position ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
