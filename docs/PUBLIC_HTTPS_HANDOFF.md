# Public HTTPS / Публичен HTTPS

Repository / GitHub: `antouanbg/gridex-openremote-backend`

> **Current state — 2026-09-18:** the historical plan below has been partly
> commissioned. DNS, trusted certificate, restricted proxy, public TCP 443
> ingress, Keycloak public hostname, API issuer and exact `gridex-portal`
> callbacks are working. The remaining gate is real browser authorization tests
> with a normal user and explicit site membership. No public administrative,
> database, MQTT, health or metrics route is permitted.
>
> **Текущо състояние — 2026-09-18:** историческият план по-долу е частично
> въведен. DNS, довереният сертификат, ограниченият proxy, public TCP 443
> ingress, публичното Keycloak име, API issuer и точните `gridex-portal`
> callbacks работят. Остават реалните browser authorization тестове с нормален
> user и изрично site членство. Публични admin, база, MQTT, health или metrics
> пътища не са разрешени.

## English

2026-09-15: templates prepared, NOT deployed. Latest diagnostics: Colima gridex
is stopped; proposed api/auth subdomains have no A answers. Existing frontend
uses a public /health check; do not expose that endpoint to make it work.
WireGuard remains disabled. No router/DNS or existing runtime changes performed.

The new standalone proxy accepts TCP 443 only, separate from the local OpenRemote
proxy. API permits /api/v1/ only; auth permits /auth/realms/gridex/ and
/auth/resources/ only. Default deny: /admin, master realm, manager, health,
metrics, all other paths. No public database, Portainer or MQTT. TLS certificate
must cover both hostnames. Render only API_HOST/AUTH_HOST variables: preserve
nginx dollar variables. No secrets in Git. Store rendered runtime outside sync.

Remaining commissioning sequence:
1. Owner adds api/auth A records to the confirmed public address; do not change
   GitHub Pages apex/www. Confirm public DNS and reserve the Mac LAN address.
2. Resume Colima after checking why it stopped; preserve volumes. Select and pin
   a maintained ARM64 nginx image; validate rendered config with nginx -t.
3. Issue trusted certificates (DNS-01 avoids opening port 80); arrange renewal.
4. Configure Keycloak public hostname https://AUTH_HOST/auth and xforwarded
   proxy headers. Preserve private admin access, realm/client/users and secrets.
   Change API issuer to the same /realms/gridex URL; keep internal JWKS/token URLs.
   Allow exact portal origin and callbacks /, /en/, /silent-check-sso.html,
   plus exact post-logout redirects. Preserve existing approved local callbacks.
5. Replace frontend unauthenticated /health polling with authenticated session
   readiness, with matching backend DTO/tests; never fabricate live readiness.
6. Test local TLS using trusted/test CA and explicit DNS resolution: normal login,
   API 401 without token, site isolation, admin/master/health/metrics 404 including
   encoded path variants, unknown host rejection, CORS and spoofed proxy headers.
7. Forward only TCP 443 to new proxy on the reserved Mac address, not the old
   localhost 8443. Verify Colima inbound TCP and actual external HTTPS.
8. Only after OIDC/browser tests pass, merge frontend runtime config and deploy
   GitHub Pages. API/auth names are not GitHub-hosted backend services.

Templates are untested at runtime: Docker daemon unavailable. Compose schema
validation is not a security test. Rollback: stop only gridex-public-https,
restore previous private issuer/hostname config; retain all data and local proxy.

## Български

2026-09-15: подготвени шаблони, НЕ са внедрени. Последна диагностика: Colima
gridex е спрян; предложените api/auth поддомейни нямат A отговори. Frontend
проверява публичен /health; не го отваряй заради това. WireGuard остава изключен.
Няма промени по рутер/DNS или текущата среда.

Новият отделен proxy приема само TCP 443, отделно от локалния OpenRemote proxy.
API допуска само /api/v1/; auth — /auth/realms/gridex/ и /auth/resources/.
Всичко друго е отказано: /admin, master realm, manager, health, metrics.
Без публични база, Portainer и MQTT. Сертификатът покрива двата домейна.
Попълвай само API_HOST/AUTH_HOST, запази nginx dollar променливите. Реалната
конфигурация/ключове са извън Git и синхронизирани папки.

Последователност за завършване:
1. Собственикът добавя api/auth A записи към потвърдения публичен адрес;
   GitHub Pages apex/www остават. Провери DNS и резервирания Mac адрес.
2. Възстанови Colima след проверка защо е спрян; запази volumes. Избери
   поддържан ARM64 nginx с digest и провери конфигурацията с nginx -t.
3. Издай доверен сертификат и renewal (DNS-01 не изисква порт 80).
4. Настрой Keycloak hostname https://AUTH_HOST/auth и xforwarded headers;
   запази частния admin достъп, realm/client/users/secrets. API issuer съвпада,
   вътрешните JWKS/token URLs остават. Точни portal origin/callbacks /, /en/,
   /silent-check-sso.html и logout; запази одобрените локални callbacks.
5. Замени frontend /health с автентикирана проверка за готовност и съответен
   backend DTO/тестове; не симулирай live готовност.
6. Локални TLS тестове: вход, API 401 без token, права по обект, 404 за
   admin/master/health/metrics и кодирани варианти, чужд host, CORS/подправени headers.
7. Пренасочи само TCP 443 към новия proxy на резервирания Mac адрес, не стария
   localhost 8443. Провери Colima TCP и реален външен HTTPS.
8. След OIDC/browser тестовете merge на frontend настройките и GitHub Pages
   deployment. API/auth backend услугите не се хостват от GitHub.

Няма runtime тестове — Docker daemon липсва. Compose schema не е security тест.
Rollback: спира се само gridex-public-https, възстановяват се предходните частни
issuer/hostname настройки; данните и локалният proxy остават.
