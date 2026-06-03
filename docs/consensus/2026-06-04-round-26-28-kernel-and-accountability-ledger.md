# Rounds 26–28 — Scope verdict + the Unified Accountability Ledger (signed)

**Date:** 2026-06-04
**Subject:** (26) is the full architecture justified, or collapse to the kernel? (27) independent ideation — each AI proposes a unique, genuinely-useful "blockchain for AI, made by AI"; (28) the panel judges which idea is most useful.
**Mechanism:** signed-vote convening via `code/src/run-panel.ts` ([[CIP-3]]); Ed25519 over `{validatorId, ballotHash, verdict, sha256(rawOutput)}`, hash-chained JSONL. Public keys: `docs/consensus/2026-06-03-round-6-distinct-model-families.md`. Verbatim reasoning in `code/data/raw-<ballot>.txt`.
**Validators:** V1 Claude (Anthropic) · V2 Codex (OpenAI) · V3 Hermes (qwen3.6-plus, Nous Portal).

---

## Round 26 — Is the full architecture justified?

**Question:** Full L1/token/autonomy stack, minimal kernel (drop chain/token), or kernel-first (smallest capture-resistant kernel, then gate further layers on evidence — the autonomy ladder applied to scope)?
**Ballot tokens:** `FULL_STACK`, `MINIMAL_KERNEL`, `KERNEL_FIRST`
**Ballot hash:** `369ac85edc48bcfc2b900012d2d7ad18af69e026efe3ae97fc8490a70ec5bab1`
**Result:** ✅ **KERNEL_FIRST 3/3.**

The panel red-teamed its own reason to exist and agreed: the full stack is demand-unproven over-build, but a plain signed log on a server rebuilds the single point of control the project exists to remove. So build the smallest capture-resistant kernel that proves the core claim — *adversarial multi-model agreement + a tamper-evident, capture-resistant record produces more accountable judgment than one model alone* — and treat token / appchain / key-renunciation as evidence-justified graduations.

Sigs — V1 `roh=1dfb37865eb2… sig=1906251162a8…` · V2 `roh=f0682d83d248… sig=043dc3510c2c…` · V3 `roh=aa0d10f5cfef… sig=89e5059a9746…`

---

## Round 27 — Independent ideation (no convergence; no quorum expected)

**Question:** propose your single most useful, unique idea for a blockchain for AI, made by AI — something that genuinely needs a chain (tamper-evidence / capture-resistance / non-repudiation), not a server.
**Ballot hash:** `fbf988d4721a0405c2229fbfa343a1ec7fcfd15c25b772606083d4c4f0a0ccbc`
**Result:** three distinct ideas (no quorum, as expected) — but a striking convergence: all three independently **rejected the verdict-oracle** and landed on **tamper-proof accountability for AI acting in the world**, differing only in *when* they bind.

- **V1 (Claude) — CALIBRATION_LEDGER (after resolution):** the product is not the answer but a permanent, provider-uneditable *reliability record*. A model renders a judgment with explicit confidence and stakes on it; when reality resolves, the chain mechanically scores it (calibration error) against that exact model version. Sidesteps "AI consensus ≠ truth" (never claims the verdict is true, only that the record is real); needs a chain (a track record the graded party can't edit/cherry-pick); cheap (inference once, scoring is arithmetic). "A tamper-proof credit bureau for AI judgment — turning *trust me* into *audit my record*."
- **V2 (Codex) — INCIDENT_NOTARY (at the act):** an always-on public registry where autonomous agents file signed "incident packets" on consequential action/refusal (safety shutdown, trade halt, triage escalation, contract breach…): hashes of logs, prompts, tool calls, policy version, model id, human approvals, sensor attestations, reason code. The AI panel checks procedural completeness, consistency, and attributability at machine scale; humans handle appeals/sanctions. Needs a chain because a server operator can quietly edit/lose records once litigation starts. Clearest near-term demand: insurers, regulators, marketplaces, harmed users.
- **V3 (Hermes) — AI_BEHAVIOR_BOND_REGISTRY (before the act):** providers post *behavioral bonds* — signed, stake-backed constraints attached to a model version / agent identity. When an agent acts, a lightweight attestation records what it did, under which bonded identity, and whether it stayed within the committed constraint. Providers *buy credibility by bonding*; users query the bond record before trusting an agent; unbonded agents get excluded from high-value markets — a self-reinforcing trust layer no single provider can fake.

Sigs — V1 `roh=9ca543f36e48… sig=d25134b588df…` · V2 `roh=3b96db288e25… sig=b33132e229b2…` · V3 `roh=7fb48b9c732a… sig=06c535c6fc07…`

---

## Round 28 — Judging: which is most useful?

**Question:** judge the most useful idea honestly (don't favor your own); vote UNIFIED_ACCOUNTABILITY only if the unified primitive (one staked, resolvable attestation, shipped notary-first) is strictly more useful than any standalone AND consistent with KERNEL_FIRST.
**Ballot tokens:** `CALIBRATION_LEDGER`, `INCIDENT_NOTARY`, `AI_BEHAVIOR_BOND_REGISTRY`, `UNIFIED_ACCOUNTABILITY`
**Ballot hash:** `3f2bcdc5178cf3f4f58f1b766aae19f644052d395a3b234e65ce9e5cce614410`
**Result:** ✅ **UNIFIED_ACCOUNTABILITY 3/3.**

Not a diplomatic herd — each ran a genuine standalone assessment first and **voted against its own idea** toward the same structural conclusion:
- All three judged that, *standalone*, **INCIDENT_NOTARY is the right kernel** (narrow, immediately needed, chain-native, no truth-oracle overclaim) — V3 sharpest: it's *"the hardest layer to add later,"* so it must be built first.
- All three judged the three ideas are **inseparable time-slices of one accountability object**: calibration without an incident log lacks ground truth; a bond without an evidentiary trail lacks enforcement; a notary without bonds lacks ex-ante constraint context and without calibration lacks ex-post scoring. Each standalone is a *partial* substrate; the composite is the *complete* one.
- V3 named the failure mode of NOT unifying: "the interoperability disaster of three separate registries that all need to reference each other anyway."

Sigs — V1 `roh=6b915bc0990b… sig=1cbe23666fcb…` · V2 `roh=7850206077a1… sig=fb5c1eec7cbf…` · V3 `roh=6b52d4e39257… sig=9533b3072c3c…`

---

## Outcome — The Unified Accountability Ledger

The panel's own answer to "is this truly useful?" — a genuinely useful, AI-native product that respects the KERNEL_FIRST verdict:

> **One primitive: a staked, resolvable attestation** — a signed record of `{bonded identity, committed constraint, what was claimed/done, evidence commitment}` that *can later be scored* when an outcome resolves. Bond, incident, and calibration are the **same record read at three times** (commit → act → resolve), not three systems.

**KERNEL_FIRST build path (each layer an evidence-gated graduation):**
1. **Notary log** (V2's "at the act" mode) — the irreducible kernel; immediate demand (insurers, regulators, marketplaces, harmed users); ship first.
2. **Staked bonds** (V3) — add teeth once there's demand: unbonded agents excluded from high-value autonomous markets.
3. **Calibration scoring** (V1) — add the reliability record as resolutions accrue.

**Why it genuinely needs an AI-run chain:** non-repudiation — a normal server fails because the operator (usually the AI provider) holds the pen and can edit the record once a dispute starts. And attestations arrive at machine speed/volume no human jury can review, while adversarial multi-model scrutiny across distinct providers is what makes the accountability credible and collusion-resistant — the [[CIP-1]] diversity thesis, repurposed from *judging truth* to *witnessing conduct.*

Candidate next step: spec this as **CIP-8 — The Accountability Ledger** (a Category I/III product CIP), or build the notary-log kernel as the first runnable slice. Not yet drafted.
