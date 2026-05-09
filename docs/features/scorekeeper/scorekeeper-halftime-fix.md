# scorekeeper-halftime-fix

## What & Why

`app/score/page.tsx` filtered matches with `.in('status', ['scheduled', 'live'])`, omitting `'halftime'`. During halftime, scorekeepers lost visibility of their match entirely — the match disappeared from the UI. The `ScoreEntry` component already renders a correct halftime state screen ("waiting for 2nd half"), so only the server query needed fixing.

## Fix

Change query filter to `.in('status', ['scheduled', 'live', 'halftime'])`.

## Behaviour

- Scorekeeper sees their match during halftime with the halftime holding screen
- Scorekeeper cannot adjust scores during halftime (correct — `canScorekeeper('halftime')` returns false)
- Match reappears as editable when organizer resumes to live
