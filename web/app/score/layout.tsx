import { Toaster } from '@/components/ui/sonner'

export const metadata = { title: 'Scorekeeper' }

export default function ScoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface-score">
      {children}
      <Toaster />
    </div>
  )
}
