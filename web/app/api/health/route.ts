import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pingTournaments } from '@/lib/db/tournaments'

export const revalidate = 0

export async function GET() {
  try {
    const supabase = await createClient()
    await pingTournaments(supabase)
    return NextResponse.json({ status: 'ok', ts: new Date().toISOString() })
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 503 })
  }
}
