import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET() {
  try {
    const supabase = await createClient()
    // Lightweight ping — keeps Supabase free tier from pausing
    await supabase.from('tournaments').select('id').limit(1)
    return NextResponse.json({ status: 'ok', ts: new Date().toISOString() })
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 503 })
  }
}
