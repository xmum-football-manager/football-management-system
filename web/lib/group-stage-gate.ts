type GateInput = { phase: string | null; status: string }

// A knockout match may only kick off once every group-stage match in the
// tournament has finished. Group results feed knockout seeding, so a single
// unfinished (or reverted-to-scheduled) group match means the bracket is not
// yet settled. Mirrors the DB-layer trigger of the same name.
export function groupStageComplete(matches: GateInput[]): boolean {
  return matches
    .filter((m) => m.phase === 'group')
    .every((m) => m.status === 'finished')
}
