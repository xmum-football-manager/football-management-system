# organizer-tournament-assignment

## What & Why

Admins need to scope existing organizer accounts to specific tournaments. Without this, an organizer created via user-role-assignment has a global `organizer` role with no `tournament_id` — they cannot see any tournament in the admin dashboard.

## Behaviour

- Visible only to admins on the tournament detail page (`/admin/tournaments/[id]`)
- Shows currently assigned organizers (email + remove button)
- Form to assign by email: resolves email → user_id via `get_user_id_by_email` RPC, then inserts `{ user_id, role: 'organizer', tournament_id }` into `user_roles`
- Removing an organizer deletes the specific `user_roles` row where `user_id + role + tournament_id` match

## API Surface

Uses Supabase client directly from the browser (anon key + RLS policies for admin).
Emails are fetched via a new `GET /api/admin/users` which already lists all users with emails.

## Dependencies

- `get_user_id_by_email` Postgres RPC function (already exists in schema)
- `user_roles` table (already exists)
- `user-role-assignment` sub-feature complete (organizers now have base role row)
