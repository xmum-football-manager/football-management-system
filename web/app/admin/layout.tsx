import { ToastContainer } from '@/components/Toast'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {children}
      <ToastContainer />
    </div>
  )
}
