import { createServiceClient } from '@/lib/supabase/server'

export const DEFAULT_PASSWORD = 'footballclub'

export async function createClubUser(input: {
  email: string
  password?: string
}): Promise<{ userId: string } | { alreadyExists: true } | { error: string }> {
  const svc = createServiceClient()
  const { data, error } = await svc.auth.admin.createUser({
    email: input.email,
    password: input.password ?? DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already been registered')) {
      return { alreadyExists: true }
    }
    return { error: error.message }
  }

  if (!data.user) return { error: 'Failed to create user.' }
  return { userId: data.user.id }
}
