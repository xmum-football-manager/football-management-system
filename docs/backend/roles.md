# Role System

Roles are stored in `user_roles` and enforced by Supabase Row Level Security (RLS) policies.

| Role | Scope | What they can do |
|---|---|---|
| `admin` | Global | Full access to everything; only role that can revert `finished` → `live` |
| `organizer` | Per tournament | Create/edit fixtures, rosters, scores; assign scorekeepers; trigger match state transitions |
| `scorekeeper` | Per tournament or per match | Update `home_score`/`away_score` on live matches they are assigned to — nothing else |

A user can hold multiple roles simultaneously (e.g., a user who is both admin and organizer).

## Helper SQL functions (used in RLS policies)

```sql
public.is_admin()                 -- true if caller has any 'admin' user_role
public.is_organizer(t_id uuid)    -- true if caller is organizer for the given tournament, or admin
public.is_scorekeeper(m_id uuid)  -- true if caller is assigned to the match (tournament-wide or match-specific), or organizer/admin
public.get_user_id_by_email(email_input text)  -- resolves email → user_id; used for scorekeeper assignment by email
```

All functions are `security definer` and `stable`.
