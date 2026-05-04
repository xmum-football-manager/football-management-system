# Auth

Supabase Auth with email/password. No OAuth.

- **Admin creates accounts** via `POST /api/admin/users/create` — enters the user's email and role, account is created with default password `footballclub`. Admin shares the credentials directly (e.g. via WhatsApp). No email is sent.
- **Session management** is handled by Supabase Auth cookies. The Next.js middleware (`proxy.ts`) reads the session cookie to guard `/admin` and `/score` routes, redirecting unauthenticated requests to the relevant login page.
- **Forced password change** — on first login, both `/admin/login` and `/score/login` check `user_metadata.must_change_password`. If true, the user is redirected to `/change-password` and must set a new password before proceeding. The flag is cleared on successful change.
- **Role assignment** happens separately after account creation — admin assigns roles via the `user_roles` table.
