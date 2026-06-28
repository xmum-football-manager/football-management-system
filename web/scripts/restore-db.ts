/**
 * Restores tournament data from a backup JSON produced by backup-db.ts.
 * Wipes ALL current tournament data, then re-inserts the snapshot.
 *
 * Run (latest backup):   npx tsx --env-file=.env.local scripts/restore-db.ts
 * Run (specific file):   npx tsx --env-file=.env.local scripts/restore-db.ts backups/db-backup-XXXX.json
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const backupsDir = resolve(__dirname, '../backups')

function resolveBackupPath(): string {
  const arg = process.argv[2]
  if (arg) return resolve(process.cwd(), arg)
  // Default: most recent db-backup-*.json in backups/
  const files = readdirSync(backupsDir)
    .filter((f) => f.startsWith('db-backup-') && f.endsWith('.json'))
    .sort()
  if (files.length === 0) {
    console.error(`No backups found in ${backupsDir}. Run backup-db.ts first.`)
    process.exit(1)
  }
  return resolve(backupsDir, files[files.length - 1])
}

// Children first (FK-safe delete order)
const WIPE_ORDER = ['admin_audit_log', 'goals', 'cards', 'matches', 'players', 'teams', 'tournaments']
// Parents first (FK-safe insert order)
const INSERT_ORDER = ['tournaments', 'teams', 'players', 'matches', 'goals', 'cards', 'admin_audit_log']
// Tables whose rows reference auth.users (user ids differ across projects), so a
// cross-project restore can't satisfy the FK. Treated as best-effort: failures
// are warned and skipped instead of aborting the whole restore.
const BEST_EFFORT = new Set(['admin_audit_log'])

async function wipeAll() {
  console.log('Wiping current data…')
  for (const t of WIPE_ORDER) {
    const { error } = await sb.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error && !error.message.includes('does not exist')) {
      console.warn(`  wipe ${t}: ${error.message}`)
    }
  }
}

async function insertRows(table: string, rows: unknown[]) {
  if (!rows || rows.length === 0) return
  // Chunk to stay well under any payload limits
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    const { error } = await sb.from(table).insert(slice)
    if (error) throw new Error(`insert ${table}: ${error.message}`)
  }
}

async function run() {
  const path = resolveBackupPath()
  console.log(`Restoring from ${path}\n`)
  const backup = JSON.parse(readFileSync(path, 'utf8'))
  const data = backup.data ?? {}

  await wipeAll()

  console.log('Inserting snapshot…')
  for (const table of INSERT_ORDER) {
    const rows = data[table] ?? []
    if (!rows.length) continue
    try {
      await insertRows(table, rows)
      console.log(`  ${table.padEnd(24)} : ${rows.length}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (BEST_EFFORT.has(table)) {
        console.warn(`  ${table.padEnd(24)} : skipped (${msg})`)
      } else {
        throw e
      }
    }
  }

  console.log(`\n✅ Restore complete (exported_at ${backup.exported_at}).`)
}

run().catch((e) => { console.error(e); process.exit(1) })
