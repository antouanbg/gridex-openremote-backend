# Approved Users layout: API evidence / API съответствие

Latest owner confirmation: both actions approved with personal-only scope.
POST /api/v1/me/service-requests/:id/cancel changes only own pending member
request to cancelled. POST /api/v1/me/services/:code/stop accepts organisationId,
derives subject/realm exclusively from verified identity and deletes only the
personal grant. New approval is required to re-enable. No schema migration.
Implemented in source, not live; historical missing-API notes below are superseded.
БГ: двете действия са потвърдени само за собствения потребител. Чакащата
заявка става cancelled; активната услуга премахва само личното разрешение.
Повторно включване изисква ново одобрение. Има код и тестове, още не е живо.

2026-10-03 source review based on main 88e8f87 plus personal controls: 149 tests,
148 pass, 1 skipped, zero failures. No production grants changed or emails sent.

| UI action | Existing API / implementation |
| --- | --- |
| Platform organisation selection | GET /api/v1/platform/organisations |
| Organisation services | GET/PUT /api/v1/platform/organisations/:id/services/:code |
| Price zone | GET/PUT /api/v1/platform/organisations/:id/market-zones/:zone |
| Platform read-only member list | GET /api/v1/platform/organisations/:id/members |
| Organisation member roster/update role+Sites | GET /api/v1/organisations/:id/members; PUT .../members/:subject |
| Individual service, including administrator self | PUT /api/v1/organisations/:id/services/:code/members/:subject |
| Personal catalogue/requests | GET /api/v1/me/service-catalog; GET/POST /api/v1/me/service-requests |
| Organisation request/cancel | POST /api/v1/organisations/:id/service-requests; POST .../:requestId/cancel |
| Decisions | POST /api/v1/platform/service-requests/:id/approve or reject; organisation-scoped equivalents |
| Invitations/history/resend | Existing platform organisation-invitations and organisation invitations routes |
| Personal request cancellation / self-service stop | New protected POST endpoints listed above; source tested, not live |

List API suffixes are omitted on GET where applicable. Each action is protected
by existing realm, verified identity, active membership and scope checks.
Platform does not call the individual grant API across customer realms.
setMember allows own organisation administrator self-grant only after the
organisation grant/zone prerequisites. Member role/Site writes reconcile
OpenRemote links; service grants do not create Site access. Outbox tests do
not prove real mail delivery. New frontend reference has NOT been deployed.

Initial audit found personal cancellation missing. Owner explicitly approved
personal-only cancellation/stop and new administrator approval for re-enable.
Five regression tests cover routes, scope, idempotency and rollback. No migration.

БГ: проверени са API за организационни и лични услуги, ценова зона, заявки,
решения, покани, хора и роли/Обекти. Супер админ не заобикаля организационния
за лични услуги. Организационен админ може да разреши собствена услуга след
организационно разрешение. OpenRemote остава източник за връзките към Обекти.
148 теста минават, 1 е пропуснат; не са променяни реални права или изпращани
писма. Новият фронтенд и двата нови API не са внедрени.
Потвърден е само личен обхват и ново админско одобрение при повторно включване.

Reference: gridex-docs docs/approved-users-screens.md and static/approved/users-three-roles.html.
