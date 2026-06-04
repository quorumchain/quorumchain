// Quorumchain ($QRM) — state-log wiring (Phase 0.4). The modules (bonds, lifecycle,
// reputation, …) stay PURE — they return new state. These recorders are the canonical
// path that maps each domain transition to a StateEvent and appends it to the shared
// tamper-evident hash chain (state-log.ts), so a transition that happened is one that
// is recorded and replayable. Per-event authorization (who signed off) and true
// on-chain anchoring layer on at the substrate, as disclosed; this is the local
// interim. Zero dependencies beyond the modules it bridges.

import { appendState, type StateEvent } from './state-log.ts';
import { type Bond } from './bonds.ts';
import { type AdmissionEvent } from './lifecycle.ts';

/** A bond posted (CREATE). Keyed by the bond's frozen-criteria ballotHash. */
export function recordBondCreate(path: string, bond: Bond): StateEvent {
  return appendState(path, {
    module: 'bond',
    type: 'CREATE',
    ref: bond.ballotHash,
    payload: { subject: bond.subject, constraint: bond.constraint, stake: bond.stake, status: bond.status },
    timestamp: bond.timestamp,
  });
}

/** A bond resolved (SETTLE) — `bond` is the settled result (SLASHED/RELEASED). The
 *  slash outcome is recorded so a later silent release is detectable. */
export function recordBondSettlement(path: string, bond: Bond, timestamp: string): StateEvent {
  return appendState(path, {
    module: 'bond',
    type: 'SETTLE',
    ref: bond.ballotHash,
    payload: { subject: bond.subject, status: bond.status, slashed: bond.slashed },
    timestamp,
  });
}

/** Validator lifecycle transitions (ADMIT/UPGRADE/GRADUATE/RETIRE/EVICT). Pass the
 *  events newly appended to a panel's admissionLog by a lifecycle op. */
export function recordAdmissions(path: string, events: AdmissionEvent[], timestamp: string): StateEvent[] {
  return events.map((e) =>
    appendState(path, { module: 'lifecycle', type: e.type, ref: e.validatorId, payload: { version: e.version, tier: e.tier }, timestamp }),
  );
}

/** A reputation re-scoring (SCORE) — the provenance-weighted source reputations for
 *  an epoch/claim-set, keyed by `ref`. */
export function recordReputation(path: string, ref: string, reps: Record<string, number>, timestamp: string): StateEvent {
  return appendState(path, { module: 'reputation', type: 'SCORE', ref, payload: { reps }, timestamp });
}
