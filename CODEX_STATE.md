# GrideX backend working state

## English

Last reviewed: 2026-09-09

### Current architecture

The backend is designed for Windows 11. Each Site Router is a distinct
WireGuard peer to the backend. ROCK Pi E, OLIMEX ESP32 nodes and OT/BESS
equipment remain behind that router. CONTROL and TELEMETRY are segregated;
site-to-site routing and public MQTT are prohibited.

### Completed baseline

- `gridex-api` is the protected backend-for-frontend boundary for OIDC,
  tenancy, OpenRemote Asset normalisation, configuration revisions and audit.
- The Suntech SunStorage Pro 261 asset/control contract, hardware topology and
  VPN-only MQTT documentation are present.
- The selectable forecast-model contract includes `lightgbm_v1` and
  `anguelov_ibex_milp_v1`.

### In progress / next work

1. Implement the forecasting/optimisation worker with adapters for IBEX
   historical/day-ahead prices and weather data.
2. Generate and persist 96 × 15-minute forecast, schedule and economics
   records; include PV/grid charge provenance and no-sale-at-loss results.
3. Publish only validated Strategy/Control Asset updates after simulation and
   commissioning gates. No direct PCS command path may be added.
4. Connect the portal model selector to the authenticated API and persist the
   selected model in a strategy draft.

### Guardrails

No real IPs, VPN ranges, keys, passwords, tokens, inventory or deployment
domains belong in Git. Runtime changes require a separate reviewed task.

---

## Български

Последен преглед: 2026-09-09

### Текуща архитектура

Backend-ът е предвиден за Windows 11. Всеки Site Router е отделен WireGuard
peer към backend-а. ROCK Pi E, OLIMEX ESP32 нодовете и OT/BESS оборудването са
зад този рутер. CONTROL и TELEMETRY са разделени; site-to-site routing и
публичен MQTT са забранени.

### Готова основа

- `gridex-api` е защитеният backend-for-frontend слой за OIDC, tenancy,
  нормализация на OpenRemote Assets, ревизии на конфигурации и audit.
- Налични са Suntech SunStorage Pro 261 asset/control договор, хардуерна
  топология и VPN-only MQTT документация.
- Избираемият договор за прогнозен модел включва `lightgbm_v1` и
  `anguelov_ibex_milp_v1`.

### В ход / следваща работа

1. Worker за прогнози и оптимизация с адаптери за IBEX исторически/ден-напред
   цени и метеорологични данни.
2. Генериране и запис на 96 × 15-минутни прогнози, график и икономика,
   включително PV/grid произход на заряда и „не продавай на загуба“.
3. Публикуване само на валидирани Strategy/Control Asset промени след
   симулация и commissioning. Не се добавя директен PCS command path.
4. Свързване на избора на модел от портала с удостоверения API и записването
   му в strategy draft.

### Ограничения

В Git не се записват реални IP адреси, VPN ranges, ключове, пароли, tokens,
inventory или deployment домейни. Runtime промени изискват отделна прегледана
задача.
