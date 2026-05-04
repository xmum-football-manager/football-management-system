# Environment Variables

| Variable | Used in | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server | Supabase anon key (RLS-enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server API routes only | Bypasses RLS — never sent to browser |
| `NEXT_PUBLIC_APP_URL` | Server API routes | Used to construct invite redirect URLs |

## Migrations

Schema is managed with Supabase CLI migrations under `supabase/migrations/`. The canonical schema is also kept at `supabase/schema.sql` for reference. Run migrations locally with `supabase db push` against the linked project.
