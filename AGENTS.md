# GrideX OpenRemote backend — Working rules

## Architecture and security

- The central backend runs on Windows 11 and hosts Docker services, GrideX API,
  PostgreSQL, OpenRemote, Keycloak, monitoring and private MQTT ingestion.
- Each physical Site has its own Site Router, which is the WireGuard peer.
  ROCK Pi, ESP/OLIMEX nodes and field devices are behind that router and do not
  run WireGuard. Site-to-site routing is prohibited by default.
- CONTROL and TELEMETRY networks are separated. No public MQTT `8883` listener
  or direct backend route to the OT/BESS network is permitted.
- Browser clients communicate only with GrideX API. GrideX API owns browser
  authorization, stable DTOs, revisions and audit; OpenRemote owns live Assets,
  datapoints, Agents and rules; Edge owns vendor drivers, heartbeat, BMS safety
  envelope, software fuse and fail-safe behaviour.
- Never commit or log tokens, passwords, private keys, customer inventory,
  production addresses or real VPN ranges. Use Docker secrets, ignored `.env`
  files and `.env.example` placeholders.

## Required task workflow

Before any change:

1. Read this file, `CODEX_STATE.md` and `HANDOFF.md`.
2. Inspect `git status`, branch, remote and the relevant implementation/docs.
3. Preserve unrelated user work and do not overwrite incomplete work.

Before each commit and final response:

1. Update `CODEX_STATE.md` with completed work, tests, known issues and the
   exact next action.
2. Update `HANDOFF.md` for every planned, partially implemented, untested,
   deployment-blocked or commissioning-blocked item. Each entry must include
   dependencies, acceptance evidence and one exact next action.
3. Remove a HANDOFF entry only after source, tests and required deployment or
   commissioning evidence exist.
4. Run relevant tests and configuration validation; inspect `git diff` and
   scan staged changes for accidental secrets.

Every `HANDOFF.md` must identify its repository directly below its title in
this form: `Repository / GitHub: <owner>/<repository>`. Never leave a handoff
ambiguous when several GrideX repositories or worktrees exist.

Repository state is authoritative. On resume, repeat the pre-change steps and
do not treat a conversation as the only source of project knowledge.

## Documentation

Keep core architecture and operational documentation English first with a
Bulgarian section where practical. When an architecture or data path changes,
update the related diagrams/docs in the same task. Keep permanent project rules
in this file, temporary progress in `CODEX_STATE.md`, and incomplete work in
`HANDOFF.md`.

## Mandatory Pull Request workflow / Задължителен Pull Request процес

- Every completed change set must be committed on a named branch, pushed to
  `origin` and given a Pull Request before it is reported as ready for review.
- Target `main` unless an explicitly documented dependency requires another
  base branch. State the scope, tests, operational limits and deployment work
  still required in the Pull Request.
- Never merge automatically. Report the URL and await the project owner's
  review/merge decision.
- If GitHub permissions or an API error prevent PR creation, record the branch,
  commit SHA and exact blocker in `CODEX_STATE.md` and `HANDOFF.md`.

- Всяка завършена промяна се commit-ва в именуван branch, push-ва се към
  `origin` и получава Pull Request, преди да бъде докладвана като готова за
  review.
- Целта е `main`, освен ако изрично документирана зависимост не изисква друга
  base branch. В Pull Request-а се описват обхватът, тестовете, оперативните
  ограничения и оставащата deployment работа.
- Не merge-вай автоматично. Докладвай URL и изчакай review/merge решение на
  собственика на проекта.
- Ако GitHub права или API грешка блокират създаването на PR, запиши branch-а,
  commit SHA и точното препятствие в `CODEX_STATE.md` и `HANDOFF.md`.
