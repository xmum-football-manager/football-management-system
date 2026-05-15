import { test as setup } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

const TEST_DATA_FILE = 'playwright/.test-data.json';

setup('seed test data', async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Upsert test tournament — delete old one first if exists
  const { data: existing } = await supabase
    .from('tournaments')
    .select('id')
    .eq('name', '__pw-visual-test-tournament')
    .maybeSingle();

  if (existing) {
    await supabase.from('tournaments').delete().eq('id', existing.id);
  }

  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .insert({
      name: '__pw-visual-test-tournament',
      description: 'Playwright visual test fixture — safe to delete',
      location: 'Test Arena',
      start_date: '2026-01-01',
      end_date: '2026-01-31',
      format: 'round_robin',
      status: 'active',
      points_win: 3,
      points_draw: 1,
      points_loss: 0,
      halftime_enabled: false,
      minutes_per_half: 45,
      require_goal_player: false,
      num_groups: 2,
      teams_per_group: 4,
      advance_per_group: 2,
    })
    .select()
    .single();

  if (tErr) throw new Error(`Failed to seed tournament: ${tErr.message}`);

  // Seed 2 teams
  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .insert([
      { tournament_id: tournament.id, name: '__pw-team-alpha' },
      { tournament_id: tournament.id, name: '__pw-team-beta' },
    ])
    .select();

  if (teamsErr) throw new Error(`Failed to seed teams: ${teamsErr.message}`);

  writeFileSync(
    TEST_DATA_FILE,
    JSON.stringify(
      {
        tournamentId: tournament.id,
        teamIds: teams!.map((t) => t.id),
      },
      null,
      2
    )
  );

  console.log(`Seeded tournament ${tournament.id} with 2 teams`);
});
