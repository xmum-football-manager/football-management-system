import { LoginForm } from './LoginForm'

export const metadata = { title: 'Admin · Sign in' }

interface Props {
  searchParams: Promise<{ redirectTo?: string }>
}

export default async function AdminLoginPage({ searchParams }: Props) {
  const { redirectTo } = await searchParams
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-3xl">⚽</div>
          <h1 className="mt-2 text-xl font-semibold text-white">Tournament Admin</h1>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-xl">
          <h2 className="text-lg font-semibold mb-4">Sign in</h2>
          <LoginForm redirectTo={redirectTo ?? '/admin'} surface="admin" />
        </div>
      </div>
    </div>
  )
}
