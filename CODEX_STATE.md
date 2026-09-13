# CODEX_STATE.md

## Current task

Maintain strict priority-backlog statistics and put item 1, the telemetry
recovery v1 contract, into owner review. No runtime service is implemented by
this task.

Поддържай строга статистика за приоритетния backlog и постави точка 1,
telemetry recovery v1 договора, в owner review. С тази задача не се
имплементира runtime услуга.

## Completed

- Added the durable, repository-specific handoff entry for the coordinated Edge
  export and backend recovery-ingestion work.
- Added an ordered pre-deployment backlog, separating local/CI implementation
  work from Windows-host-dependent commissioning.
- Added strict task statistics and marked item 1 as in review, not completed.

- Добавен е трайният, специфичен за repository-то handoff запис за
  координираните Edge export и backend recovery-ingestion задачи.
- Добавен е подреден pre-deployment backlog, който разделя local/CI
  имплементацията от commissioning, зависещ от Windows машината.
- Добавена е строга task статистика и точка 1 е отбелязана като в преглед, а
  не като изпълнена.

## Remaining

- Obtain the owner decision for item 1, then update the statistics before
  beginning item 2.

- Получи решение от собственика за точка 1, после обнови статистиката преди
  началото на точка 2.

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

Record the owner decision for item 1. If approved, mark it approved-but-not-
implemented, keep completed at zero, and start the PostgreSQL/Timescale
migration foundation as item 2.

Запиши решението на собственика за точка 1. Ако е одобрена, отбележи я като
одобрена, но неимплементирана, запази изпълнените на нула и започни
PostgreSQL/Timescale migration основата като точка 2.

## Last updated

2026-09-13
