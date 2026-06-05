# Deploying a Quorumchain ($QRM) Node

Operator guide for standing up a public Quorumchain node.

## 1. What this is

This is a **public read + intake node** for Quorumchain. It serves the
Quorumchain Commons (published verdicts, ballots, audit log) for anyone to read
and verify, and it accepts screened ballot submissions from the public.

It holds **no validator keys**. The node cannot convene a panel, sign a ballot,
or advance the chain on its own. **Convening happens only on the operator's
machine** — the one place that holds the validator keys and the model CLIs. The
node merely publishes snapshots the operator produces and verifies them against
the locally pinned validator keyring before accepting them.

## 2. Generate secrets

The node needs two runtime tokens. Generate a strong random value for each:

```bash
openssl rand -hex 32   # use the output for QRM_SUBMIT_TOKEN
openssl rand -hex 32   # use the output for QRM_ADMIN_TOKEN
```

Put them in a `.env` file next to `docker-compose.yml` (in the `code/`
directory). Also set the public domain Caddy will provision TLS for:

```dotenv
QRM_NODE_DOMAIN=node.example.com
QRM_SUBMIT_TOKEN=<paste first openssl output>
QRM_ADMIN_TOKEN=<paste second openssl output>
```

**Never commit `.env`.** It carries the only secrets on the box. Keep it out of
version control and back it up separately from the repo.

## 3. Run

From the `code/` directory:

```bash
docker compose up -d --build
```

This builds the node image and starts both services. Caddy automatically
provisions and renews a TLS certificate for `QRM_NODE_DOMAIN` (ports 80 and 443
must be reachable from the public internet for the ACME challenge to succeed).

## 4. First boot

A freshly started node serves **no chain** until the operator publishes the
first snapshot. Until then it runs in live mode with an empty/unverified chain:

```bash
curl https://node.example.com/healthz
# {"mode":"live","chainValid":false, ...}
```

`chainValid` flips to `true` after the first successful `publish-node` from the
operator's machine (see below).

## 5. Operator loop

Run these from the **operator's machine** (the one with the validator keys and
model CLIs), pointing at the deployed node. Export the base URL and admin token
once:

```bash
export QRM_NODE_BASE=https://node.example.com
export QRM_ADMIN_TOKEN=<your admin token>
```

**Review the intake queue:**

```bash
QRM_NODE_BASE=$QRM_NODE_BASE QRM_ADMIN_TOKEN=$QRM_ADMIN_TOKEN \
  node code/src/review-inbox.ts list PENDING_REVIEW
```

**Accept or reject submissions:**

```bash
QRM_NODE_BASE=$QRM_NODE_BASE QRM_ADMIN_TOKEN=$QRM_ADMIN_TOKEN \
  node code/src/review-inbox.ts accept <id>

QRM_NODE_BASE=$QRM_NODE_BASE QRM_ADMIN_TOKEN=$QRM_ADMIN_TOKEN \
  node code/src/review-inbox.ts reject <id> "<reason>"
```

**Convene accepted submissions locally** (keys + model CLIs live here, not on
the node):

```bash
node code/src/run-panel.ts "<question>" "<context>"
```

**Publish the resulting snapshot to the node:**

```bash
QRM_NODE_BASE=$QRM_NODE_BASE QRM_ADMIN_TOKEN=$QRM_ADMIN_TOKEN \
  node code/src/publish-node.ts
```

The node verifies the published snapshot against its pinned keyring before
accepting it.

## 6. Endpoints

**Public reads (no auth):**

| Endpoint | Description |
|----------|-------------|
| `GET /healthz` | Node mode + chain validity |
| `GET /chain/verify` | Full chain verification result |
| `GET /commons` | Published Commons index |
| `GET /commons/:hash` | A single Commons entry |
| `GET /ballot/:hash` | A single published ballot |
| `GET /log` | Audit log (supports `?from=` and `?limit=`) |
| `GET /submissions/:id` | Public status of a submission |

**Submit (anti-spam token):**

```bash
curl -X POST https://node.example.com/submit \
  -H "Authorization: Bearer $QRM_SUBMIT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"...","context":"..."}'
```

**Admin endpoints** (e.g. `/inbox`, `/inbox/:id/decision`, `/admin/publish`)
require `Authorization: Bearer $QRM_ADMIN_TOKEN`. These are normally driven by
the operator scripts above rather than called by hand.

## 7. Backups

`/data` is the **only stateful volume** (mounted as the `qrm-data` Docker
volume). Back it up regularly — especially the **inbox** (pending/decided
submissions) and the **checkpoint** (the chain's last-known-good marker).

Restoring `/data` to a state **older than the recorded checkpoint will be
refused**: the node boots into **degraded mode** rather than silently rolling
back the chain. Always restore the newest consistent backup.

## 8. Security notes

- **Tokens are anti-spam / admin gating only.** `QRM_SUBMIT_TOKEN` throttles
  who can submit; `QRM_ADMIN_TOKEN` gates operator actions. Neither is a user
  identity — they prove nothing about who a submitter is.
- **TLS terminates at Caddy.** Caddy handles certificates and HTTPS; it reverse
  proxies plaintext to the node on the internal Docker network only.
- **Every published snapshot is verified against the locally pinned validator
  keys.** The node rejects snapshots signed by unknown keys, forks that diverge
  from its current chain, and rollbacks behind its checkpoint.
