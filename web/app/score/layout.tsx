import { ToastContainer } from '@/components/Toast'

export default function ScoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {children}
      <ToastContainer />
    </div>
  )
}
