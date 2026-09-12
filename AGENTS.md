# GrideX OpenRemote backend — Working Rules

## Architecture and safety

The central backend runs on Windows 11 with Docker, PostgreSQL, OpenRemote and
GrideX API services. Each physical site has a dedicated Site Router that is the
WireGuard peer; ROCK Pi, ESP/OLIMEX nodes and OT/BESS devices are behind it.
Do not install WireGuard on field devices, expose OT/BESS networks, enable
public MQTT, or introduce unrestricted site-to-site routing.

GrideX API owns authorization, tenancy, stable DTOs, configuration revisions
and audit. OpenRemote owns live Assets, datapoints, rules and Agents. Edge owns
drivers, vendor protocol mappings, heartbeat, BMS envelope, software fuse and
fail-safe control. Do not bypass the Edge safety envelope.

Never commit secrets, real IP/VPN ranges, credentials, certificates, tokens,
customer inventory or deployment domains. Use placeholders and `.env.example`.

## Required task workflow

1. Read this file, `CODEX_STATE.md` and `HANDOFF.md`.
2. Inspect `git status`, current branch and relevant docs before editing.
3. Preserve unrelated work; use small, logical commits.
4. Update tests, bilingual core documentation and `CODEX_STATE.md` when
   implementing material changes.
5. Before committing, inspect `git diff`, `git status` and accidental-secret
   exposure.

## Mandatory handoff policy

`HANDOFF.md` is the durable repository backlog for concrete work that is
planned but not implemented, commissioned or verified.

- Read it at the beginning of every repository task.
- Update it before the final response and before the final commit/push whenever
  work is deferred, blocked, awaiting infrastructure, or otherwise incomplete.
- Each entry must include dependencies, acceptance evidence and the exact next
  action. Remove it only after code, tests and required deployment evidence
  demonstrate completion.
- Never store secrets, real network details or customer data in it, and never
  declare the task complete while the related handoff entry is stale.
