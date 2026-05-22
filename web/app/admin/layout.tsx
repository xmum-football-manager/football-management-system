import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/db/roles'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { LogOut, ShieldCheck, Users, Trophy } from 'lucide-react'

export const metadata = { title: 'Tournament Admin' }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user

  // /admin/login children render their own layout; bypass the chrome
  if (!user) {
    return <div className="surface-admin">{children}<Toaster /></div>
  }

  // First login: force password change
  if (user.user_metadata?.must_change_password) {
    redirect('/change-password?redirectTo=/admin')
  }

  const admin = await isAdmin(user.id)

  return (
    <div className="surface-admin">
      <header className="sticky top-0 z-30 border-b bg-white shadow-sm">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <Trophy className="h-5 w-5 text-emerald-600" />
            <span>Tournament Admin</span>
          </Link>
          <div className="flex-1" />
          {admin && (
            <Link href="/admin/users">
              <Button variant="ghost" size="sm">
                <Users className="h-4 w-4" /> Users
              </Button>
            </Link>
          )}
          <span className="hidden sm:inline text-xs text-muted-foreground max-w-[180px] truncate">
            {user.email}
          </span>
          {admin && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
              <ShieldCheck className="h-3 w-3" /> Admin
            </span>
          )}
          <form action="/admin/auth/signout" method="post">
            <Button variant="ghost" size="sm" type="submit" title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <Toaster />
    </div>
  )
}
