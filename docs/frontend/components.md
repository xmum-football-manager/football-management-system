# Component Structure

```
components/
  MatchCard.tsx       — match display card (participant view)
  StandingsTable.tsx  — league standings table (participant view)
  LiveBadge.tsx       — animated "LIVE" indicator
  Toast.tsx           — toast notification system (admin/score views)
```

shadcn/ui components are used only within `/admin` — not in `/t/[id]`, `/score`, or `/`.
