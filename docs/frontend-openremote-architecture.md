# GrideX frontend and OpenRemote backend boundary

## English

Customers use the GrideX portal; the OpenRemote Manager UI is an engineering and commissioning tool. The browser uses OIDC Authorization Code + PKCE for login, then talks only to `gridex-api` over HTTPS JSON and an authenticated Server-Sent Events stream.

The API validates the user token locally, applies its explicit role-to-permission map and checks GrideX PostgreSQL organisation/site membership. It does not pass a browser token through as its authority for managed Assets. Instead, after local authorisation, a confidential server-side client reads only the OpenRemote Asset IDs bound to that site and normalises them into GrideX DTOs.

The browser never receives OpenRemote service credentials, raw Asset JSON, MQTT credentials, vendor register addresses, device connection data or a direct PCS route. Runtime writes target only protected Strategy and Control Assets and remain disabled until commissioning.

The full API, database ownership, device blueprints and revision model are defined in `docs/gridex-api-v1.md`.

## Български

Клиентите работят в GrideX портала, а OpenRemote Manager UI е само инженерна среда за commissioning и диагностика. Браузърът влиза чрез OIDC Authorization Code + PKCE и след това комуникира единствено с `gridex-api` чрез HTTPS JSON и защитен Server-Sent Events поток.

API услугата валидира token-а, прилага собствена карта роля→право и проверява членството в организация/обект в GrideX PostgreSQL. След това сървърният confidential client чете само свързаните с обекта OpenRemote Assets и ги преобразува в GrideX DTOs.

Към браузъра не се връщат OpenRemote service credentials, raw Asset JSON, MQTT данни, vendor регистри, connection настройки или директен път към PCS. Командите се записват само в защитени Strategy и Control Assets и остават заключени до приключен commissioning.
