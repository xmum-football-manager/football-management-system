# user-role-assignment

## What & Why

When Admin creates a new Organizer or Scorekeeper account via `POST /api/admin/users/create`, the API was creating the Supabase auth user but never inserting a row into `user_roles`. This meant the newly created user had no role in the system and could not access any role-gated pages.

## Fix

After successfully creating the auth user, insert into `user_roles`:

```ts
{ user_id: created.user.id, role: 'organizer' | 'scorekeeper', tournament_id: null }
```

`tournament_id` is null at creation time. For organizers, tournament assignment is done separately via the organizer-tournament-assignment UI. For scorekeepers, assignment is done via the scorekeeper assignment page.

## API Surface

`POST /api/admin/users/create` — body: `{ email: string, role: 'organizer' | 'scorekeeper' }`

Returns `{ success: true, userId: string }` on success.

## Dependencies

- `user_roles` table with columns: `user_id`, `role`, `tournament_id` (nullable)
- Caller must have `role = 'admin'` in `user_roles`
- Service client required for `auth.admin.createUser`
