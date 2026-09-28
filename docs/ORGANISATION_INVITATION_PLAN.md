# Organisation and member invitations / Покани за организации и членове

## Current authority and status / Актуално решение и статус — 2026-09-26

2026-09-27 action-email gate: The first `novacom` email was delivered, but the
public auth proxy initially returned 404 for its realm. The exact
`/auth/realms/novacom/` route now passes local HTTPS checks; a broad realm
wildcard was rejected and never deployed. Before sending any future customer
action email, provision and verify its own public realm route while keeping
`master` and admin blocked. External recipient completion, acceptance and
tenant-isolation checks remain outstanding. The first one-time URL was shared
in chat and must be replaced; no token is recorded here.

2026-09-27: Първото писмо за `novacom` бе доставено, но публичното auth proxy
първоначално връщаше 404 за неговия realm. Точният маршрут
`/auth/realms/novacom/` вече минава локалните HTTPS проверки; общ шаблон
бе спрян и никога не е внедряван. Преди писмо за бъдещ клиент провери
отделния му публичен realm маршрут, като `master` и admin остават затворени.
Външното приемане и проверката на изолацията предстоят. Първият еднократен
линк бе споделен в чата и трябва да се замени; тук не пазим токени.

The older implementation plan below is historical; its “not deployed” gates
are superseded by this section. The existing owner account remains the human
platform administrator **and** administrator of the pilot GrideX organisation;
do not replace or re-register it. `platform:manage` is derived by the API only
from its verified Keycloak subject in the pilot `gridex` realm, not from an
email comparison, display label, generic `admin` role or possession of a setup
credential. First-organisation invitation requires a recent sign-in (10 min).
The permanent `gridex-realm-setup` master client is backend-only; its broad
OpenRemote/Keycloak master role is a technical provisioning capability, never
a person-facing login or browser token. Keep its secret in the sole private
backend env; audit and limit its use to the verified platform action.

Each customer organisation has a separate OpenRemote realm. A successful send
initiates realm/client/identity provisioning and a Keycloak action email
through the existing Mailgun provider. It does **not** activate the
organisation or membership. The invited first admin verifies email, sets a
password, signs in to that realm and accepts from Profile; only then may the
backend activate the corresponding organisation and membership after checking
OpenRemote rights. Organisation administrators may invite only within their
own active realm and only to Sites they manage. Member roles are viewer,
operator, energy manager and integrator; delegating `administrator` through
this flow is **not implemented**. Site scope is explicit, never all Sites by
default; zero-Site membership grants no Site access. Pending, failed or
revoked invitations confer no rights. Never grant rights solely in local SQL
or in Keycloak without the authoritative OpenRemote realm and bindings.

Migration 012 and the setup client are active on the backend branch. Local
SNI/TLS probes verified auth discovery 200 and unauthenticated invite API 401.
The public frontend route returned HTTP 200. **No first customer email,
password setup, acceptance or cross-tenant denial has yet been verified.**
The zero-Site frontend fix is a local unpublished commit. Treat setup as live
but end-to-end onboarding as unaccepted. Preserve the owner's existing pilot
organisation, Sites and ROCK/ESP ownership.

Български: горното е актуалното правило, а старите точки по-долу са история.
Глобалният администратор е съществуващият човешки акаунт с проверен `subject`,
не служебният setup client. Само backend използва служебния client. Първият
администратор се кани от глобалния; след приемането кани хора само в своята
организация с конкретни роли и Обекти. Поканата без приемане не дава права.
Реалната първа клиентска покана и изолацията между организации още не са
потвърдени от край до край.

Status 2026-09-24: Separate-realm first-admin onboarding is implemented as an
opt-in code path and fixture-tested, not deployed or accepted with a real user.
Migration 012, verified existing owner subject activation, dedicated master
setup client and real delivery through the existing Keycloak Mailgun REST
provider (including configured BCC) are rollout gates. No SMTP is required.
OpenRemote managed Asset access remains pilot-realm-only until a separate
per-realm service-client design is implemented. See HANDOFF for the exact gate.

Статус 2026-09-24: Потокът за първи администратор в отделен realm е подготвен
като opt-in код и тестван с фикстури, не е внедрен/проверен с реален човек.
Миграция 012, активиране на съществуващия owner subject, отделен master setup
client и реална проверка през наличния Keycloak Mailgun API модул с BCC
остават условия за пускане. SMTP не е нужно. Asset service
достъпът в OpenRemote засега е само за пилотния realm; виж HANDOFF.

Status: implementation in progress; NOT deployed. Owner selected one separate
OpenRemote realm per customer organisation on 2026-09-24. Multi-realm login,
provisioning and acceptance are still to be implemented and tested.

## English

The single administration destination is Customers & contracts → Users &
invitations (`/customers/users/`). It does not replace the existing Profile
screen where a recipient accepts an invitation. The owner explicitly requested
this submenu; no other navigation items change.

1. A platform administrator is a specifically bound, verified Keycloak subject,
   not anyone with an `admin` role string or matching email text. Granting this
   permission requires a private operator setting in the single backend `.env`,
   a recent authenticated session and an auditable bootstrap. The actual owner
   subject has not yet been confirmed or configured.
2. The platform administrator may invite one email to become the first
   administrator of a NEW organisation. The request includes the organisation
   display name and a stable slug. The email invitation alone creates no active
   organisation, Site or OpenRemote inventory. Acceptance requires the same
   verified identity, an unexpired non-revoked invitation and completed
   OpenRemote provisioning before membership is activated.
3. An organisation administrator may invite another member only to an active
   organisation and only to Sites that administrator can manage. Roles are
   selected explicitly: viewer, operator, energy manager or integrator.
   Delegating the organisation-administrator role is a separate policy decision;
   the existing API rejects it. No invitation silently grants all Sites.
4. Invitations are single-use, expire after 24 hours, can be revoked, are
   audited and fail closed if identity or email delivery is unconfirmed. Existing
   Keycloak enrollment email may be reused; never expose an admin credential
   in the browser. Pending/partial work must reconcile idempotently.

Architectural decision: each new organisation gets its OWN OpenRemote realm,
consistent with `organisations.openremote_realm UNIQUE`. The existing `gridex`
realm remains the pilot. Never reuse it as a catch-all or silently switch to
shared-realm tenancy without explicit owner approval. Provision and verify the
new realm through OpenRemote before activating the organisation or its first
administrator; reconcile partial failures idempotently. The existing single-
realm portal issuer, API authorization, client setup and Manager access must be
designed/tested for multi-realm users without weakening isolation. No global
send endpoint or owner privilege is activated before this work and an
authenticated owner acceptance test. Existing-organisation member invitations
already exist in the API; this change adds a dedicated UI route and tightens
inviter Site scope.

Acceptance: authorised platform admin can invite a new organisation admin;
unprivileged users receive 403; email/identity failure grants nothing; recipient
accepts once; OpenRemote hierarchy and access are verified; organisation admin
invites permitted roles/Sites through the submenu; cross-organisation and
out-of-scope Site grants fail; URL refresh preserves the screen; BG/EN and
mobile navigation are checked with real accounts. No rollout based only on
mocked tests.

## Български

Единният административен екран е „Клиенти и договори → Потребители и покани“
(`/customers/users/`). Той не заменя „Профил“, където получателят приема
поканата. Собственикът поиска изрично това подменю; останалото меню не се пипа.

1. Глобалният администратор е изрично обвързан с потвърден Keycloak `subject`,
   а не всеки с текстова роля `admin` или съвпадащ имейл. Правото се задава
   през частна настройка в единния backend `.env`, с пресен вход и одит.
   Действителният `subject` на собственика още не е потвърден и настроен.
2. Глобалният администратор може да покани един имейл за първи администратор
   на НОВА организация. Заявката съдържа име и постоянен кратък идентификатор.
   Самият имейл не създава активна организация, Обект или OpenRemote инвентар.
   Приемането изисква същата потвърдена самоличност, валидна неотменена покана
   и завършено OpenRemote провизиране преди активиране на членството.
3. Администратор на организация кани членове само в активна организация и
   само за Обекти, които сам управлява. Ролите се избират изрично:
   наблюдател, оператор, енергиен мениджър или интегратор. Предоставяне на
   администраторска роля е отделно решение; текущият API го отказва.
   Покана не дава автоматично всички Обекти.
4. Поканата е еднократна, валидна 24 часа, може да се отмени, записва се в
   одит и не дава права при непотвърдена доставка на имейл/самоличност.
   Наличният Keycloak enrollment имейл може да се използва; администраторски
   данни не отиват в браузъра. Частичните операции се възстановяват
   идемпотентно.

Решението е ВСЯКА нова организация да получава СОБСТВЕН OpenRemote realm,
както подсказва `organisations.openremote_realm UNIQUE`. `gridex` остава за
пилотната организация; не го използвай като общ realm и не променяй модела
без изрично ново одобрение. Първо провизирай и провери realm през OpenRemote,
после активирай организацията и първия ѝ администратор; частичните грешки се
съгласуват идемпотентно. Текущите едно-realm portal issuer, API права,
клиент и Manager достъп изискват multi-realm проектиране и тест, без отслабване
на изолацията. Без глобален endpoint за покани или активиране на право за
собственика преди тази реализация и реален тест с неговия вход.
Поканите към членове вече съществуват в API; промяната добавя отделен UI
маршрут и затяга обхвата на Обектите на изпращащия администратор.

Приемане: упълномощен глобален администратор кани първи администратор;
неупълномощен получава 403; грешка в имейл/идентичност не дава членство;
получателят приема веднъж; проверени са OpenRemote йерархия и права;
администратор на организация кани разрешени роли/Обекти през подменюто;
чужда организация и чужди Обекти се отказват; refresh пази екрана; проверени
са BG/EN и мобилната навигация с реални акаунти. Mock тестове не са достатъчни
за внедряване.
