# RLS Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `tournaments` | Public (anon + auth) | Admin only | Organizer for their tournament, or admin | — |
| `teams` | Public | Organizer for the tournament | Organizer | Organizer |
| `players` | Public | Organizer for the team's tournament | Organizer | Organizer |
| `matches` | Public | Organizer for the tournament | Scorekeeper (scores only, when live) or organizer | — |
| `user_roles` | Own row, or admin | Admin or organizer (scorekeeper role only) | — | Admin or organizer (scorekeeper role only) |
| `admin_audit_log` | Admin only | Admin only | — | — |

Frontend routing (`/admin`, `/score`) is a secondary UX guard only. RLS is the actual security boundary — bypassing the frontend does not bypass access control.
