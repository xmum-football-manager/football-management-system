import Link from 'next/link'
import { TournamentWizard } from './TournamentWizard'

export default function NewTournamentPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="text-slate-500 hover:text-slate-700 text-sm">← Dashboard</Link>
          <span className="font-bold text-slate-900">New Tournament</span>
          <div className="w-24" />
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <TournamentWizard />
      </main>
    </div>
  )
}
