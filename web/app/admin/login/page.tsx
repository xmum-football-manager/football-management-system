import { Trophy } from 'lucide-react'
import { LoginForm } from './LoginForm'

export const metadata = { title: 'Admin · Sign in' }

interface Props {
  searchParams: Promise<{ redirectTo?: string }>
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const { redirectTo } = await searchParams
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <span
            className="grid h-11 w-11 place-items-center rounded-lg"
            style={{
              background: 'var(--admin-lime)',
              color: 'var(--primary-foreground)',
              boxShadow: '0 10px 24px -12px color-mix(in srgb, var(--admin-lime) 70%, transparent)',
            }}
          >
            <Trophy className="h-5 w-5" />
          </span>
          <h1 className="admin-display mt-3 text-[20px] leading-none">Pitch · Admin</h1>
          <p className="admin-eyebrow mt-2">Tournament Console</p>
        </div>
        <div
          className="rounded-lg bg-card text-card-foreground p-6 shadow-sm"
          style={{ border: '1px solid var(--admin-rule)' }}
        >
          <h2 className="text-lg font-semibold mb-4">Sign in</h2>
          <LoginForm redirectTo={redirectTo ?? '/admin'} surface="admin" />
        </div>
      </div>
    </div>
  )
}
