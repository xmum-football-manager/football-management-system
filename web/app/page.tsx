import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Tournament } from '@/lib/supabase/types'

export const revalidate = 60

export default async function HomePage() {
  const supabase = await createClient()
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .in('status', ['setup', 'active'])
    .order('start_date', { ascending: true })

  const list = (tournaments ?? []) as Tournament[]

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#0f172a] text-white px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-3xl mb-1">⚽</p>
          <h1 className="text-2xl font-bold">Live Tournaments</h1>
          <p className="text-slate-400 text-sm mt-1">Follow scores and standings in real time</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {list.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-slate-600 font-medium">No active tournaments right now.</p>
            <p className="text-slate-400 text-sm mt-1">Check back soon.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {list.map(t => (
              <Link key={t.id} href={`/t/${t.id}`}>
                <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-green-500 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-bold text-slate-900 truncate">{t.name}</h2>
                      {t.description && (
                        <p className="text-slate-500 text-sm mt-0.5 line-clamp-2">{t.description}</p>
                      )}
                      {t.location && (
                        <p className="text-slate-400 text-xs mt-1">📍 {t.location}</p>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      t.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {t.status === 'active' ? 'Live' : 'Upcoming'}
                    </span>
                  </div>
                  {t.start_date && (
                    <p className="text-xs text-slate-400 mt-2">
                      {new Date(t.start_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {t.end_date && ` – ${new Date(t.end_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
