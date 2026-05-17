# CSV Import for Teams + Players

## Problem
Adding teams and players one at a time via the UI is slow for bulk entry (e.g., 8 teams × 16 players = 128 individual adds).

## Solution
CSV file import with one row per player. Teams auto-created from unique team names. Downloadable template CSV.

## CSV Format
```
team_name,player_name,jersey_number,position
Thunderhawks,John Smith,1,GK
Thunderhawks,Mike Lee,7,CMD
Grovers,Alex Tan,10,ST
```

## Features
- Download CSV template button
- Import CSV file picker
- Preview before import (team count, player count)
- Validation: missing columns, empty required fields, invalid jersey numbers
- Duplicate handling: skip existing teams by name, skip existing players by name within team
- Toast summary after import

## Files
- `web/public/team-import-template.csv` — example CSV
- `web/app/admin/tournaments/[id]/CsvImport.tsx` — import component
- `web/app/admin/tournaments/[id]/TeamsTab.tsx` — add import buttons
