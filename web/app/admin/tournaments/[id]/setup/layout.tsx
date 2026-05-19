'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getTournament } from '@/lib/db/tournaments'
import { TabStrip } from '../TabStrip'

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id: string }
  const [tournamentName, setTournamentName] = useState('')

  useEffect(() => {
    const supabase = createClient()
    getTournament(supabase, id).then(t => { if (t) setTournamentName(t.name) })
  }, [id])

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="text-slate-500 hover:text-slate-700 text-sm">← Dashboard</Link>
          <span className="font-bold text-slate-900 truncate max-w-xs">{tournamentName}</span>
          <div className="w-20" />
        </div>
      </header>
      <TabStrip />
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
