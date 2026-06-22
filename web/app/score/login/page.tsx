import { ClipboardList } from 'lucide-react'
import { LoginForm } from '../../admin/login/LoginForm'

export const metadata = { title: 'Score · Sign in' }

interface Props {
  searchParams: Promise<{ redirectTo?: string }>
}

export default async function ScoreLoginPage({ searchParams }: Props) {
  const { redirectTo } = await searchParams
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span
            className="grid h-16 w-16 place-items-center rounded-2xl text-white shadow-lg"
            style={{ background: '#16A34A' }}
          >
            <ClipboardList className="h-8 w-8" />
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900">Scorekeeper</h1>
          <p className="mt-1 text-base font-medium text-slate-500">Sign in to keep score</p>
        </div>
        <div className="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm [&_button]:h-12 [&_button]:text-base [&_button]:font-bold [&_input]:h-12 [&_input]:text-base [&_label]:text-base">
          <LoginForm redirectTo={redirectTo ?? '/score'} surface="score" />
        </div>
      </div>
    </div>
  )
}
