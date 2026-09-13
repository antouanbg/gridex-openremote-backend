# CODEX_STATE.md

## Current task

Prioritize and document backend work that can be completed before the Windows
11 backend host is available. No runtime service is implemented by this task.

Приоритизирай и документирай backend работата, която може да се завърши преди
Windows 11 backend машината да е налична. С тази задача не се имплементира
runtime услуга.

## Completed

- Added the durable, repository-specific handoff entry for the coordinated Edge
  export and backend recovery-ingestion work.
- Added an ordered pre-deployment backlog, separating local/CI implementation
  work from Windows-host-dependent commissioning.

- Добавен е трайният, специфичен за repository-то handoff запис за
  координираните Edge export и backend recovery-ingestion задачи.
- Добавен е подреден pre-deployment backlog, който разделя local/CI
  имплементацията от commissioning, зависещ от Windows машината.

## Remaining

- Execute the numbered HANDOFF items in priority order, beginning with owner
  approval of the versioned export/acknowledgement contract.

- Изпълнявай номерираните HANDOFF точки по важност, като започнеш с owner
  approval на versioned export/acknowledgement договора.

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
the versioned record identity and acknowledgement contract are approved; then
start the PostgreSQL/Timescale migration foundation.

Създай координираните Edge и backend implementation Pull Request-и едва след
одобрение на versioned record identity и acknowledgement договора; след това
започни с PostgreSQL/Timescale migration основата.

## Last updated

2026-09-13
