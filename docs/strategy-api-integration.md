# GrideX strategy API and OpenRemote integration

## English

The canonical browser contract is maintained with the frontend:

- [OpenAPI 3.1 contract](https://github.com/antouanbg/gridex-energy-os/blob/main/docs/integration/frontend-backend-contract.yaml)
- [Strategy and settings lifecycle](https://github.com/antouanbg/gridex-energy-os/blob/main/docs/integration/STRATEGY_AND_SETTINGS_CONTRACT.md)
- [Strategy configuration JSON Schema](https://github.com/antouanbg/gridex-energy-os/blob/main/docs/integration/schemas/strategy-configuration.schema.json)
- [User preferences JSON Schema](https://github.com/antouanbg/gridex-energy-os/blob/main/docs/integration/schemas/user-preferences.schema.json)

### Backend responsibility

The GrideX API implements the contract. PostgreSQL stores immutable strategy versions, drafts, approvals, simulations, user preferences and audit events. A strategy belongs to a site, not to a user. User preferences cannot change physical control.

Activation is asynchronous:

```text
validated draft
  -> PostgreSQL desired revision
  -> OpenRemote Strategy Asset strategyDocument + strategyDesiredRevision
  -> OpenRemote validation/rules
  -> strategyAppliedRevision or strategyLastError
  -> GrideX API strategy status
```

The API returns `202 Accepted` for activation and keeps the lifecycle as `activating` until OpenRemote reports the same applied revision. A rejected or timed-out revision does not replace the last active version.

Recommended Strategy Asset attributes:

| Attribute | Purpose |
|---|---|
| `strategyCode` | Stable mode code, never a translated display label. |
| `strategyDocument` | Complete canonical JSON document for the desired revision. |
| `strategyDesiredRevision` | PostgreSQL revision requested for activation. |
| `strategyAppliedRevision` | Revision accepted by OpenRemote rules. |
| `strategyLifecycle` | `activating`, `active` or `rejected` execution state. |
| `strategyDecision` | Current timestamped decision, horizon, power request and reason codes. |
| `strategyLastError` | Stable code and safe message; no internal secrets. |

OpenRemote writes requested values only to the Control Asset. Edge validates BMS limits, software fuse, command TTL, heartbeat and communication state before applying any command. Strategy configuration cannot raise factory limits.

### Required implementation order

1. Add the PostgreSQL strategy-version, draft, simulation, approval and audit tables.
2. Implement catalogue, read and draft endpoints with site/role isolation and `ETag`/`If-Match`.
3. Validate the JSON Schema plus site capabilities, tariff references and safety relationships.
4. Implement deterministic simulation output with input data/model versions.
5. Map activation and applied status to the OpenRemote Strategy Asset.
6. Keep writes locked until commissioning tests verify the complete OpenRemote -> Control Asset -> Edge path.

## Български

Каноничният OpenAPI договор и JSON схемите са в линковете по-горе. Backend-ът ги реализира, а не предоставя директен OpenRemote достъп на браузъра.

PostgreSQL пази версиите, черновите, одобренията, симулациите, личните preferences и audit събитията. Стратегията принадлежи на обекта, не на отделен потребител. Личните настройки не могат да променят физическото управление.

При активиране API връща `202 Accepted`. Frontend-ът показва `activating`, докато OpenRemote не върне `strategyAppliedRevision`, равна на `strategyDesiredRevision`. При отказ или timeout остава последната работеща версия и се връща безопасен код за грешка.

OpenRemote Strategy Asset съдържа кода, целия JSON документ, желаната/приложената версия, lifecycle, текущото решение и последната грешка. Правилата подават само желана мощност към Control Asset. Edge остава окончателният контрол за BMS лимити, software fuse, TTL, heartbeat и състояние на комуникацията.

Редът за реализация е: PostgreSQL таблици; catalogue/read/draft endpoints; schema/capability validation; версияна симулация; OpenRemote activation/status mapping; и едва след commissioning — разрешаване на writes.
