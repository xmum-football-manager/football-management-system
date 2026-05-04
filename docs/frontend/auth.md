# Auth Flow

- Admin/Organizer/Scorekeeper authenticate via Supabase Auth (email + password)
- `proxy.ts` middleware guards `/admin` and `/score` routes — unauthenticated requests are redirected to the relevant login page with a `redirectTo` param
- The login page itself is excluded from the auth check to avoid redirect loops
- Role checks happen at the database layer via RLS — frontend routing is a secondary guard only
