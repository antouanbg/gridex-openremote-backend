# Navigation catalogue / Каталог на менюто

## English

Owner approval: 2026-10-03. Migration 023 adds 27 navigation metadata rows.
It does not create users, Sites, inventory or grants. OpenRemote remains
authoritative; existing service grants are reused.

GET /api/v1/me/navigation requires the normal verified bearer session,
current organisation-access check and current realm-scoped memberships.
It returns realm, subject and items with id, parentId, path, labelKey,
sortOrder, requirement, serviceCode, revision, visible and state.
Responses are no-store. This endpoint describes presentation, never permission
to perform a resource action. Existing resource endpoints enforce access again.

States: available, denied, coming_soon, inventory_required. Asset presence is
resolved by the portal using its authorised inventory API; never invent an asset
from a menu row. Pending requests remain in the existing service-request API.
A catalogue/grant read failure must not become an empty set of confirmed rights.

The portal uses a known component/route registry; adding a database row alone
does not implement a page. BG/EN label keys live in frontend locale resources,
not duplicated free-form labels in permission records. New languages require
resource parity and registration. Legacy routes remain compatible.

Deploy only after explicit live approval and paired tests:
node scripts/deploy-navigation.mjs --apply
The script verifies environment parity, backs up the database and API image,
applies additive SQL and restarts only gridex-api. A failed health check restores
the old image; the additive table may remain. Never drop customer data to roll back.
The whole-site i18n conversion and remaining legacy pages are not claimed complete.

## Български

Одобрение: 03.10.2026. Миграция 023 добавя 27 записа за структурата на менюто,
без нови потребители, Обекти, инвентар или разрешения. OpenRemote остава
основен източник; преизползват се текущите разрешения за услуги.

GET /api/v1/me/navigation изисква нормалната проверена bearer сесия,
активен достъп до организацията и членство в текущия realm. Връща realm,
subject и items с id, parentId, path, labelKey, sortOrder, requirement,
serviceCode, revision, visible и state. Отговорът е no-store. Това не е
разрешение за действие; всеки ресурсен API проверява правата отново.

Състояния: available, denied, coming_soon, inventory_required. Наличните
активи идват от разрешения API за инвентара, не от ред в менюто. Чакащите
заявки остават в съществуващия API за услуги. Грешка при четене на каталога
или правата не означава успешно проверен празен списък с разрешения.

Frontend използва регистър на познатите компоненти/адреси; само запис в
базата не създава нов екран. BG/EN ключовете са в езиковите ресурси, не в
дублирани свободни текстове на правата. Нов език изисква същите ключове и
регистрация. Старите адреси продължават да се разпознават.

Внедряване само след конкретно одобрение за живата среда и сдвоени тестове:
node scripts/deploy-navigation.mjs --apply
Скриптът сравнява настройките, прави backup на базата и API image, прилага
добавящата миграция и рестартира само gridex-api. При неуспешна health проверка
връща предишния image; новата таблица може да остане. Не трий клиентски данни.
Цялостният i18n преход и останалите стари екрани не са обявени за завършени.
