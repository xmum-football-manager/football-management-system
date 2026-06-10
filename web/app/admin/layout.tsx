import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/db/roles'
import { ThemeToggle } from '@/components/admin/ThemeToggle'
import { Toaster } from '@/components/ui/sonner'
import { LogOut, ShieldCheck, Trophy, Users } from 'lucide-react'

// Re-declare the template — a plain-string title here would stop the root template
// from applying to child segments (login, users, tournaments, …)
export const metadata = { title: { default: 'Admin · Pitch', template: '%s · Pitch' } }

async function readTheme(): Promise<'light' | 'dark'> {
  const c = await cookies()
  return c.get('admin-theme')?.value === 'dark' ? 'dark' : 'light'
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  const theme = await readTheme()
  const surfaceClass = `surface-admin${theme === 'dark' ? ' dark' : ''}`

  // /admin/login children render their own layout; bypass the chrome
  if (!user) {
    return (
      <div className={surfaceClass}>
        {children}
        <Toaster />
      </div>
    )
  }

  // First login: force password change
  if (user.user_metadata?.must_change_password) {
    redirect('/change-password?redirectTo=/admin')
  }

  const admin = await isAdmin(user.id)

  return (
    <div className={surfaceClass}>
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{
          borderColor: 'var(--admin-rule)',
          background: theme === 'dark' ? 'rgba(14,26,18,0.82)' : 'rgba(255,255,255,0.82)',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 h-14">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span
              className="grid h-[30px] w-[30px] place-items-center rounded-lg"
              style={{
                background: theme === 'dark' ? 'var(--admin-lime)' : '#0E1A12',
                color: theme === 'dark' ? '#0E1A12' : 'var(--admin-lime)',
                boxShadow:
                  theme === 'dark'
                    ? '0 0 0 1px rgba(163,230,53,0.3), 0 6px 16px -6px rgba(163,230,53,0.45)'
                    : '0 6px 16px -8px #0E1A12',
              }}
            >
              <Trophy className="h-4 w-4" />
            </span>
            <span className="admin-display text-[18px] leading-none">Pitch · Admin</span>
          </Link>
          <div className="flex-1" />
          {admin && (
            <Link
              href="/admin/users"
              className="admin-tab hidden text-[12px] sm:inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Users className="h-3.5 w-3.5" /> Users
            </Link>
          )}
          <span className="hidden md:inline admin-mono text-[11px] text-muted-foreground max-w-[200px] truncate">
            {user.email}
          </span>
          {admin && (
            <span
              className="admin-tab hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
              style={{
                color: 'var(--admin-lime)',
                background: 'var(--admin-lime-wash)',
                border: '1px solid color-mix(in srgb, var(--admin-lime) 35%, transparent)',
              }}
            >
              <ShieldCheck className="h-3 w-3" /> Admin
            </span>
          )}
          <ThemeToggle theme={theme} />
          <form action="/admin/auth/signout" method="post">
            <button
              type="submit"
              title="Sign out"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <Toaster />
    </div>
  )
}
