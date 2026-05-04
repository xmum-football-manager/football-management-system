'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast, ToastContainer } from '@/components/Toast'

export default function AddUserPage() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'organizer' | 'scorekeeper'>('organizer')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to create user.'); return }
      toast.success(`Account created for ${email}. Default password: footballclub`)
      setEmail('')
    })
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/admin/users" className="text-slate-500 hover:text-slate-700 text-sm">← Users</Link>
          <span className="font-bold text-slate-900">Add User</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="user@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
            <div className="space-y-2">
              {(['organizer', 'scorekeeper'] as const).map(r => (
                <label key={r} className="flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="mt-0.5 accent-green-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 capitalize">{r}</p>
                    <p className="text-xs text-slate-500">
                      {r === 'organizer' ? 'Can manage tournaments, fixtures, rosters, and assign scorekeepers' : 'Can only enter scores for assigned matches'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
            The account will be created with the default password <span className="font-mono font-semibold">footballclub</span>. Share this with the user — they will be required to change it on first login.
          </p>
          <button type="submit" disabled={isPending}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors">
            {isPending ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
      </main>
      <ToastContainer />
    </div>
  )
}
