import { KeyRound } from 'lucide-react'
import { ChangePasswordForm } from './ChangePasswordForm'

export const metadata = { title: 'Set a new password' }

interface Props {
  searchParams: Promise<{ redirectTo?: string }>
}

export default async function ChangePasswordPage({ searchParams }: Props) {
  const { redirectTo } = await searchParams
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span
            className="grid h-16 w-16 place-items-center rounded-2xl text-white shadow-lg"
            style={{ background: '#16A34A' }}
          >
            <KeyRound className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-900">Set a new password</h1>
          <p className="mt-1 text-base font-medium text-slate-500">Choose a password only you know.</p>
        </div>
        <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm [&_button]:h-12 [&_button]:text-base [&_button]:font-bold [&_input]:h-12 [&_input]:text-base [&_label]:text-base">
          <ChangePasswordForm redirectTo={redirectTo ?? '/admin'} />
        </div>
      </div>
    </div>
  )
}
