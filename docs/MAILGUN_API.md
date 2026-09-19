# Mailgun REST transport / Mailgun REST изпращане

## English

The internal transport in `services/gridex-api/src/mailgun.mjs` sends multipart
messages through the fixed EU/US Mailgun HTTPS endpoints. It disables tracking,
uses a 15-second timeout, rejects redirects and does not automatically retry
ambiguous requests. Provider acceptance means queued, not delivered.

Copy `deploy/mailgun.env.example` to a private runtime directory and fill the
approved domain/from/region. Store a newly rotated domain sending key using
macOS Keychain Access: new password item, item name `gridex-mailgun-sending`,
account `gridex-mailgun`. Paste the key in its password field. Never commit it.
Run from this repository (replace private path and recipient):

```sh
node --env-file=/private/runtime/mailgun.env scripts/test-mailgun.mjs owner@example.com --keychain
```

The default uses Mailgun test mode and does not deliver mail. After domain/DNS
verification, add `--send` for one real test message. No automatic repeat sends.
If a request times out, inspect Mailgun events before retrying.

This is a transport foundation, not completed invitation delivery. Existing
Keycloak `execute-actions-email` uses its email provider; it does not automatically
use this module. A Mailgun HTTP email provider for Keycloak (or a separately
reviewed identity-link integration) is still required before enabling enrollment.
Do not replace identity action links with invented tokens or mark email verified
without verification. Enrollment remains disabled. Live API testing is pending
a replacement for the disclosed key; its persistence was denied by approval review.

## Български

Вътрешният модул `services/gridex-api/src/mailgun.mjs` изпраща multipart писма
към фиксираните EU/US Mailgun HTTPS адреси. Изключва tracking, има 15-секунден
timeout, отказва redirects и не повтаря автоматично неясни заявки. Приемането
от доставчика означава поставяне в опашка, не доказана доставка.

Копирай `deploy/mailgun.env.example` в частната runtime директория и попълни
одобрените domain/from/region. Запази нов заменен domain sending ключ чрез
macOS Keychain Access: нов password item, име `gridex-mailgun-sending`,
account `gridex-mailgun`. Постави ключа в password полето. Не го добавяй в Git.
Изпълни горната команда от репото с частния път и адреса на получателя.

По подразбиране Mailgun test mode не доставя писмо. След DNS/domain проверката
добави `--send` за едно реално тестово писмо. Няма автоматично повторение.
При timeout провери Mailgun events преди нов опит.

Това е основа за транспорт, не завършена доставка на покани. Съществуващият
Keycloak `execute-actions-email` използва своя email provider и не започва
автоматично да ползва този модул. Нужен е Mailgun HTTP email provider за
Keycloak или отделно прегледана identity-link интеграция преди enrollment.
Не заменяй identity action links с измислени tokens и не отбелязвай email като
потвърден без проверка. Enrollment остава изключен. Реалният API тест чака
замяна на публикувания ключ; записът му беше отказан от approval проверката.
