# Member access 021 — OpenRemote link authorization / Отказ за връзки потребител–Обект

## What happened / Какво се случи

On 2026-10-02, the approved member-roster/API rollout was paused after a
read-only live check. OpenRemote returned 403 for
`GET /asset/user/link?realm=…&userId=…` with the existing backend service
tokens in both current realms. In the pilot realm, reading the Site Asset
succeeded and listing links without the `userId` filter returned 200; adding
`userId` returned 403. The master setup client has `read:admin`/`write:admin`
but no asset roles. No user–Asset link was changed by this check.

На 2026-10-02 внедряването спря след проверка само за четене. OpenRemote
отказва с 403 филтрираното четене на връзките по `userId` и в двата
действащи realm-а. В пилотния realm самият Site Asset се чете, а списъкът
с връзки без този филтър връща 200. Setup client няма Asset роли.
Проверката не променя нито една връзка.

## Containment / Ограничаване

- Migration 021 added only nullable name columns. Pre-migration custom-format
  backup: `/Users/antouan/GrideX-runtime/private-backups/member-access-021.xHUkzX/gridex.dump`.
  `pg_restore -l` passed. Before and after: 2 organisations, 3 memberships,
  1 invitation.
- The candidate API image was replaced by the exact previous image and its
  container is healthy. Rollback tag:
  `gridex-api-rollback:before-member-access-021-20261002`.
- The frontend and BG/EN docs were merged to GitHub but **not deployed**.
  Existing invitation and Site screens continue to use the previous API.
- `GRIDEX_MEMBER_ACCESS_ENABLED` defaults to false in the follow-up source.
  Until that safety patch is merged and deployed, keep the restored API image.

Миграцията не трие данни. Старият API образ е възстановен и е здрав.
Новият frontend и документация не са публикувани на живите домейни.

## Required before activation / Условия преди включване

1. Approve a backend-only, per-realm OpenRemote client or another
   least-privilege method to read/create/delete user–Asset links after
   verified invitation acceptance. Do not silently expand the global master
   setup client. Define provisioning for every future realm.
2. Reconcile the `userId` filter behavior against the installed OpenRemote
   version. If fetching all links in a realm is required, filter strictly in
   backend memory and never return another user's links to the browser.
3. Grant newly invited members only the necessary OpenRemote roles; keep
   pending invitations without usable Site access. Verify Site link creation,
   removal, rollback and cross-realm denial in a synthetic tenant.
4. Rerun API tests, frontend CI/browser suite, migration idempotency and
   authenticated acceptance for pilot and customer administrators. Deploy
   backend first, enable the flag only after those checks, then frontend and
   BG/EN docs. Preserve the existing Compose layers and private env.

Преди активиране се одобрява отделен служебен клиент за всеки realm,
проверява се изолацията и се изпитва реалният вход и даване/отнемане на
Обект. Глобалният setup client не се разширява без изрично решение.
