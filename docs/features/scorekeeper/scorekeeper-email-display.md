# scorekeeper-email-display

## What & Why

The scorekeepers management page showed truncated `user_id` UUIDs (`abc12345…`) instead of email addresses. Organizers couldn't tell who was assigned. The service client needed to resolve user IDs to emails, but it can't be used from the browser.

## Solution

A new API route `GET /api/admin/scorekeepers?tournamentId=<id>` resolves the join server-side using the service client and returns `[{ user_id, email, match_id }]`. The ScorekeepersPage fetches from this route instead of the raw user_roles table for the display list.

The assignment and removal forms still write directly to Supabase from the browser (same pattern as before) — only the read/display path goes through the API.

## Access Control

Caller must be admin OR organizer of the specified tournament. Returns 403 otherwise.
