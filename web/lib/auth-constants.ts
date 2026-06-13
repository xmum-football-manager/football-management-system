// Client-safe constants. Must NOT import anything that pulls in server-only
// modules (e.g. lib/supabase/server, which uses next/headers) — this file is
// imported by client components.

export const DEFAULT_PASSWORD = 'footballclub'
