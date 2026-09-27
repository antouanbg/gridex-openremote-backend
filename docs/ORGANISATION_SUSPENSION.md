# Organisation suspension / Спиране на организация

## Suspending and restoring an approved organisation

Available in the super-admin panel. Access controls were verified with synthetic organisations; the first real customer suspension and its email delivery remain unverified. This is separate from resending any onboarding invitation.

Only the verified super administrator can use **Customers & contracts → Users & invitations → New organisation → Approved organisations**. The pilot organisation is protected and is not listed. A recent sign-in is required for changes.

Choose **Suspend organisation**, review the organisation name, then confirm. Access is blocked; existing sessions and streams end. Accounts, roles, Sites and OpenRemote inventory remain intact. Members see “Your organisation is temporarily suspended. Contact the super administrator.”

The verified first administrator receives one BG/EN suspension notice per suspension operation. Queued does not mean delivered. **Check delivery** checks the recipient's provider delivery event without sending again. An unknown or failed result must be investigated; repeating the button never automatically resends an uncertain email. This mandatory access notice is separate from optional event subscriptions.

If a step fails, portal/API access stays blocked and the existing operation remains available for reconciliation. A pending operation is not confirmation that the OpenRemote change has completed. Choose **Complete existing operation** instead of creating another request. Notification problems do not restore access. **Complete notification** can finish a notice that has not yet been attempted.

Choose **Restore access** and confirm to restore the existing permissions after the realm is verified. Members must sign in again; old tokens do not regain access. Restoration sends no new invitation or password email and does not recreate accounts.

## Временно спиране и възстановяване на одобрена организация

Функцията е налична в панела на супер администратора. Достъпът е проверен със синтетични организации; първото реално клиентско спиране и доставката на уведомлението още не са проверени. Това е отделно от повторно изпращане на покана.

Само провереният супер администратор използва **Клиенти и договори → Потребители и покани → Нова организация → Одобрени организации**. Пилотната организация е защитена и не присъства в списъка. За промяна е нужен скорошен вход.

Изберете **Спри организацията**, проверете името и потвърдете. Достъпът се блокира; текущите сесии и потоци се прекратяват. Акаунтите, ролите, Обектите и OpenRemote инвентарът се запазват. Членовете виждат „Организацията е временно спряна. Свържете се със супер администратора.“

Провереният първи администратор получава едно BG/EN уведомление за всяка операция по спиране. „В опашка“ не означава доставено. **Провери доставката** проверява събитието за доставка до получателя, без повторно изпращане. Неясен или неуспешен резултат изисква проверка; повторно натискане никога не изпраща автоматично имейл с неясна доставка. Задължителното уведомление за достъп е отделно от доброволния абонамент за събития.

При отказ достъпът през портала/API остава блокиран и съществуващата операция може да се довърши. Чакаща операция не потвърждава, че OpenRemote промяната е завършила. Изберете **Довърши съществуващата операция**, вместо да създавате нова заявка. Проблем с уведомлението не възстановява достъпа. **Довърши уведомяването** довършва имейл, чието изпращане още не е започнало.

Изберете **Възстанови достъпа** и потвърдете. След проверка на realm-а се връщат съществуващите права. Членовете влизат отново; старите токени не получават достъп. Възстановяването не изпраща нова покана или писмо за парола и не създава повторно акаунти.

## Operator acceptance / Проверки при внедряване

EN: Migration 013 adds workflow columns and an operation table only. Back up the GrideX database before applying it. Deploy the pinned `1.30.0-organisation-access-v2` Manager image before setting `GRIDEX_ORGANISATION_ACCESS_ENABLED=true` in the single private backend env. The image preserves the existing per-realm issuer patch and adds per-request realm/not-before checks, WebSocket input/output guards and explicit realm-session closure. Do not enable this API on an unpatched Manager. Deploy API with the existing Mailgun values; never print them. Restore access only through the same operation, never by manually flipping SQL status. Keep admission disabled if image, migration or auth regression fails. A rollback must retain suspended status, revocation cutoff and mail operations; never restore an old database over live revocations.

BG: Миграция 013 добавя само workflow колони и таблица за операции. Архивирай GrideX базата преди прилагане. Внедри фиксирания Manager образ `1.30.0-organisation-access-v2`, преди `GRIDEX_ORGANISATION_ACCESS_ENABLED=true` в единния частен backend env. Образът пази съществуващата issuer поправка и добавя проверки за realm/not-before на всяка заявка, защита на вход/изход на WebSocket и изрично прекратяване на сесиите в realm-а. Не включвай API с непоправен Manager. API получава наличните Mailgun настройки, без отпечатване. Възстановявай през същата операция, никога с ръчна смяна на SQL статуса. При неуспешна проверка на образ, миграция или auth настройката остава изключена. Rollback пази статуса, revocation cutoff и операциите за писма; не възстановявай стара база върху живи забрани.

EN evidence: 68 backend tests including an isolated PostgreSQL transaction/locking suite; 47 Chromium tests and 23 frontend unit/render tests; lint has only two pre-existing image warnings. The pinned Manager image compiles and passes issuer and access-guard tests. The isolated real OpenRemote/Keycloak test verifies cross-realm denial, existing WebSocket closure, disabled login, restoration, stale-token rejection and fresh-token access. No real organisation was suspended and no email was sent. Provider delivery tests are fixtures; the first real suspension must retain the actual delivery result as evidence. Browser data already received cannot be recalled; online UI clears on the next denied request or session check (20 seconds), and background tabs recheck on resume. API and streams check before returning new data.

BG доказателства: 68 backend теста с изолиран PostgreSQL за транзакции/заключване; 47 Chromium и 23 frontend unit/render теста; lint има само две стари предупреждения за изображения. Фиксираният Manager образ се компилира и минава issuer/access-guard тестовете. Изолираният реален OpenRemote/Keycloak тест проверява отказ между realm-и, затваряне на WebSocket, забранен вход, възстановяване, отказ на стар токен и достъп с нов. Няма спряна реална организация или изпратен имейл. Тестовете за доставка са с фикстури; при първото реално спиране запази резултата от доставката. Вече получени данни не могат да се отзоват; онлайн UI се изчиства при следващ отказ или проверка на сесията (20 секунди), а фоновите табове проверяват при връщане. API и потоците проверяват преди връщане на нови данни.

## Source references / Източници

- OpenRemote 1.30.0 `ManagerKeycloakIdentityProvider`, `RealmResourceImpl` and `ClientEventService`, pinned by SHA-256 in the image build.
- Keycloak Admin REST: https://www.keycloak.org/docs-api/26.7.4/rest-api/index.html (realm update, localization, logout-all).
- Mailgun Events: https://documentation.mailgun.com/docs/inboxready/api-reference/optimize/mailgun/events/get-v3-domain_name-events (message/recipient delivery checks).
- Delegated owner request from task `EMS OpenRemote architecture Phase3`, ID `01a0cea9-3cd0-7430-b309-95795bf293a6`. The task reader returned empty decision items; repository decisions and the explicit delegated request were used. No claim is made to have read unavailable decision turns.
- Делегирано искане от задачата по-горе. Инструментът върна празни записи за решенията; използвани са решенията в репотата и изричното делегирано искане, без твърдение за прочетени недостъпни съобщения.
