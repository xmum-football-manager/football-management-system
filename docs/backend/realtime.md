# Real-time

The public tournament view (`/t/[id]`) subscribes to Supabase Realtime on the `matches` table filtered by `tournament_id`. On any change event it refetches matches and standings. If the WebSocket connection drops, it falls back to polling every 30 seconds. It also refetches on tab visibility change (when the user returns to the browser tab).

## Storage

Supabase Storage (free tier) is used for team logos and player photos. Not yet wired up in Phase 1 UI.
