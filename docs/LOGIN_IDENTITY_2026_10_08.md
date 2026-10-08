# Login identity regression / Регресия на самоличността при вход

## English

Status: source fixed and deployed after explicit Keycloak-only approval;
external browser acceptance pending. No accounts, credentials, roles or realm
configuration have been changed.

Deployment: image 1072596eb5e5, healthy; other container IDs/start times unchanged.
Private backup login-theme-74jtXg includes the prior runtime and public-schema
dump; rollback image retained. FreeMarker and Mailgun tests passed. Local master
issuer/console/fresh form passed; forced-local public gridex/novacom forms show
the patched template and synthetic email. Admin/master/health/metrics return 404,
anonymous Manager 401. This is not an external authenticated browser acceptance.

The portal passes `login_hint` with `prompt=login` and `max_age=0`. Git history
places this forced-login contract on 2026-09-30 (frontend 72b0fe0), not in the
2026-10-08 API-only Site metadata/font release. Fresh no-cookie requests to both
active realm login forms correctly populated a synthetic email. This does not
prove an authenticated browser flow.

Root cause: pinned OpenRemote login.ftl ignores Keycloak's `usernameHidden`
reauthentication state. Keycloak already binds the cookie identity and leaves
login.username empty, while supplying auth.attemptedUsername. The OpenRemote
template nevertheless renders an empty required username field. The previous
test covered a fresh login redirect, not this server-rendered session state.
The user's reported timing is not proof the latest API release changed the theme.

Fix: display the server-bound identity read-only in that state, using escaped
auth.attemptedUsername, with the standard restart-login link. Never display a
different untrusted login_hint as the bound identity. The normal fresh form still
prefills the hint. Password checks, prompt/max_age, PKCE, issuer and post-login
identity matching stay unchanged. No JavaScript cookie or token access.

Build-time patch targets only the pinned template entry in the upstream theme
JAR. It fails if the expected upstream marker changes. Real FreeMarker tests
reproduce the old blank field and verify fresh hint, bound identity, empty login
model, mismatched hint, escaping, restart and the retained password field.
Existing Mailgun tests must also pass. Rollout needs explicit Keycloak-only
approval, private backup/rollback image, unchanged effective environment and
the auth-routing regression gate. No other service restart is authorised.

External acceptance: Demo → email → correct visible identity → password →
correct portal account; repeat with an existing same-realm SSO cookie, then
logout and another test identity. Do not submit a password for a different
displayed identity: restart the flow. Verify BG/EN and desktop/mobile. Credentials
and session URLs must not appear in reports.

## Български

Статус: поправен код и внедряване след изрично одобрение само за Keycloak;
външното приемане предстои. Няма промени на акаунти, пароли, роли или realm настройки.

Образ 1072596eb5e5 е healthy; другите контейнери не са пресъздадени/рестартирани.
Частно копие login-theme-74jtXg пази предишния runtime и public схемата, запазен
е rollback образ. FreeMarker/Mailgun и локалните master проверки минават.
Принудителните локални публични форми gridex/novacom показват поправения шаблон
и тестовия имейл. Admin/master/health/metrics: 404; анонимен Manager: 401.
Това не замества реален удостоверен вход от външния браузър.

Порталът подава login_hint, prompt=login и max_age=0 още от frontend 72b0fe0
(30.09), не от API поправката за Обекти/шрифтове на 08.10. Без бисквитки и
двете реални форми попълват тестовия имейл. Това не доказва завършен вход.

Причина: OpenRemote login.ftl не обработва usernameHidden при повторно
удостоверяване. Keycloak вече е избрал самоличността от бисквитката и подава
auth.attemptedUsername, но login.username е празно. Шаблонът неправилно показва
празно задължително поле. Старият тест проверява пренасочване при нов вход,
не този сървърно визуализиран случай. Последователността във времето не доказва,
че последният API ъпдейт е променил темата.

Поправката показва действително избрания потребител само за четене и стандартна
връзка за започване отначало. Не замества самоличността с непроверен login_hint.
При чист вход имейлът остава предварително попълнен. Парола, принудителен вход,
PKCE, issuer и проверката за съответстваща самоличност остават непроменени.

Patch-ът засяга само точния шаблон в pinned upstream JAR и спира при различен
очакван маркер. FreeMarker тестовете възпроизвеждат старото празно поле и
проверяват нов вход, стара самоличност, празен login модел, различен hint,
escaping, започване отначало и запазена парола. Mailgun тестовете също се пазят.
Внедряване: изрично разрешение само за Keycloak, частен backup/rollback образ,
непроменена среда и auth-routing проверки. Без рестарт на други услуги.

Външно приемане: демо → имейл → правилна видима самоличност → парола → правилен
акаунт; повторение със запазена SSO сесия, после изход и друг тестов потребител.
При различен показан потребител започни отначало, не въвеждай паролата.
Провери BG/EN и desktop/mobile. Без пароли и session адреси в отчетите.
