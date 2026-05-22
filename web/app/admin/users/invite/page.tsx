import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { InviteForm } from './InviteForm'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Add User' }

export default async function InvitePage() {
  await requireAdmin()
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <Link href="/admin/users" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground gap-1 mb-1">
          <ArrowLeft className="h-3 w-3" /> Users
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Add User</h1>
        <p className="text-sm text-muted-foreground">
          Creates an account with the default password. Share credentials with the user directly.
        </p>
      </div>
      <Card>
        <CardContent className="p-6">
          <InviteForm />
        </CardContent>
      </Card>
    </div>
  )
}
