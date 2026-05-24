import { ChangePasswordForm } from './ChangePasswordForm'

export const metadata = { title: 'Set a new password' }

interface Props {
  searchParams: Promise<{ redirectTo?: string }>
}

export default async function ChangePasswordPage({ searchParams }: Props) {
  const { redirectTo } = await searchParams
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-white text-center mb-6">Set a new password</h1>
        <div className="rounded-lg bg-white p-6 shadow-xl">
          <ChangePasswordForm redirectTo={redirectTo ?? '/admin'} />
        </div>
      </div>
    </div>
  )
}
