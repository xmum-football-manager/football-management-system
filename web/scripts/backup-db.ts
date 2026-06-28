/**
 * Backs up all tournament-related data to a timestamped JSON file.
 * Run: npx tsx scripts/backup-db.ts
 *
 * Output: backups/db-backup-<timestamp>.json
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function fetchAll(table: string) {
  const { data, error } = await sb.from(table).select('*')
  if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`)
  return data ?? []
}

async function run() {
  console.log('Fetching all data…')
  const [tournaments, teams, players, matches, goals, cards, userRoles, auditLog] = await Promise.all([
    fetchAll('tournaments'),
    fetchAll('teams'),
    fetchAll('players'),
    fetchAll('matches'),
    fetchAll('goals'),
    fetchAll('cards'),
    fetchAll('user_roles').catch(() => []), // organizer/scorekeeper assignments
    fetchAll('admin_audit_log').catch(() => []), // optional table
  ])

  const backup = {
    exported_at: new Date().toISOString(),
    counts: {
      tournaments: tournaments.length,
      teams: teams.length,
      players: players.length,
      matches: matches.length,
      goals: goals.length,
      cards: cards.length,
      user_roles: userRoles.length,
      admin_audit_log: auditLog.length,
    },
    data: { tournaments, teams, players, matches, goals, cards, user_roles: userRoles, admin_audit_log: auditLog },
  }

  const outDir = resolve(__dirname, '../backups')
  mkdirSync(outDir, { recursive: true })
  const filename = `db-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  const outPath = resolve(outDir, filename)
  writeFileSync(outPath, JSON.stringify(backup, null, 2))

  console.log(`\n✅ Backup saved to backups/${filename}`)
  console.log(`   Tournaments : ${tournaments.length}`)
  console.log(`   Teams       : ${teams.length}`)
  console.log(`   Players     : ${players.length}`)
  console.log(`   Matches     : ${matches.length}`)
  console.log(`   Goals       : ${goals.length}`)
  console.log(`   Cards       : ${cards.length}`)
  console.log(`   User roles  : ${userRoles.length}`)
  console.log(`   Audit log   : ${auditLog.length}`)
}

run().catch((e) => { console.error(e); process.exit(1) })
