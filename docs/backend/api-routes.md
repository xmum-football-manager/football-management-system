# API Routes

Two Next.js API routes exist. All other operations call Supabase directly.

## `POST /api/admin/users/create`

Creates a new Organizer or Scorekeeper account with a default password.

**Auth:** Caller must be authenticated and have the `admin` role.

**Request body:**
```json
{ "email": "user@example.com", "role": "organizer" | "scorekeeper" }
```

**Response:**
```json
{ "success": true, "userId": "uuid" }
```

The account is created with `email_confirm: true` and password `footballclub`. `must_change_password: true` is set in `user_metadata`. On first login, both `/admin/login` and `/score/login` detect this flag and redirect to `/change-password` before allowing access.

**Why an API route:** Uses `auth.admin.createUser()`, which requires the service role key. The key must never reach the browser, so this runs server-side only.

---

## `GET /api/admin/users`

Returns all users in the system with their assigned roles.

**Auth:** Caller must be authenticated and have the `admin` role.

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "roles": [
        { "role": "organizer", "tournament_id": "uuid" },
        { "role": "scorekeeper", "tournament_id": "uuid" }
      ]
    }
  ]
}
```

**Why an API route:** Uses `auth.admin.listUsers()`, which requires the service role key for the same reason as the invite route.
