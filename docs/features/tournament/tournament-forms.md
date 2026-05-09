# tournament-forms

## What this does

Updates the New Tournament and Edit Tournament forms with:

1. **Format options**: Round Robin, Round Robin + Knockout, Knockout Only
2. **Points presets**: two radio-style choices only — "3 / 2 / 1" (win/draw/loss) or "1 / 0.5 / 0"; no free-form number inputs
3. **Date validation**: end date must not be before start date (client-side, enforced by `min` attribute on end_date input)
4. **Location default**: new form pre-fills location with "Xiamen University Malaysia, Football Field"
5. **Granular field locking on edit**:
   - Name: locked when `canEditTournamentName` returns false (within 14 days of start_date or finished/archived)
   - Description + Venue: locked when `canEditVenueDescription` returns false (tournament is active/finished/archived)
   - Format + Points: locked once first match is scheduled (unchanged)
   - Dates: locked once tournament is active (unchanged)

## Dependencies

Requires `canEditTournamentName` and `canEditVenueDescription` from sub-feature 1.
