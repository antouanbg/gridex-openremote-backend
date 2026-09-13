# CODEX_STATE.md

## Current task

Document the planned recovery ingestion of the ROCK Pi local telemetry journal.
No recovery-worker source code is implemented by this task.

Документирай планирания recovery ingestion на local telemetry journal-а на ROCK
Pi. С тази задача не се имплементира source code за recovery worker.

## Completed

- Added the durable, repository-specific handoff entry for the coordinated Edge
  export and backend recovery-ingestion work.

- Добавен е трайният, специфичен за repository-то handoff запис за
  координираните Edge export и backend recovery-ingestion задачи.

## Remaining

- Agree the versioned export/acknowledgement contract with the Edge repository.
- Implement the idempotent PostgreSQL ingestion worker in a separate Pull
  Request, then prove recovery without any control command.

- Договори versioned export/acknowledgement договора с Edge repository-то.
- Имплементирай idempotent PostgreSQL ingestion worker в отделен Pull Request,
  после докажи recovery без control команда.

## Modified files

- `HANDOFF.md`
- `CODEX_STATE.md`
- `docs/integration-flow.md`
- `docs/TELEMETRY_JOURNAL_RECOVERY_V1.md`

## Tests

- Documentation-only change; `git diff --check` passed.

## Known issues

- No export, acknowledgement, replay or backend recovery worker exists yet.

## Next action

Create the coordinated Edge and backend implementation Pull Requests only after
the versioned record identity and acknowledgement contract are approved.

Създай координираните Edge и backend implementation Pull Request-и едва след
одобрение на versioned record identity и acknowledgement договора.

## Last updated

2026-09-13
