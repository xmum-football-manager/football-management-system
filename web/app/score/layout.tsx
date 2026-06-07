import { Toaster } from '@/components/ui/sonner'

// Re-declare the template — a plain-string title here would stop the root template
// from applying to child segments (login, …)
export const metadata = { title: { default: 'Scorekeeper · Pitch', template: '%s · Pitch' } }

export default function ScoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface-score">
      {children}
      <Toaster />
    </div>
  )
}
