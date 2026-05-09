# tournament-setup-view

## What this does

Adds an inline "Tournament Setup" card to the tournament detail page
(`/admin/tournaments/[id]`) that lets organizers and admins edit the venue
(location) and dates directly without navigating to the full edit form.

The card is shown when the tournament status is `setup`. It uses the same
lock rules as the edit form:
- Location: editable while `canEditVenueDescription` returns true (setup only)
- Dates: editable while `canEditDates` returns true (setup only)
- End date has a `min` constraint equal to start date

## Component

`TournamentSetupCard` — client component embedded in the server-rendered
detail page via a `<Suspense>`-safe pattern (data passed as props).

## Dependencies

Requires lock-rule functions from sub-feature 1. Sits alongside the existing
detail page from sub-feature 2 (format display update).
