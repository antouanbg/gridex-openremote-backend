# GrideX data-services contract

## Български

Двата worker-а не съдържат конфигурация на обекти. Те откриват OpenRemote
assets с активиран `damEnabled`, `forecastOpenMeteoEnabled` или
`weatherOpenMeteoEnabled` и четат параметрите при всеки цикъл.

`ElectricitySupplierAsset` изисква `damZoneEic` и `damTimezone`. Worker-ът
пише `tariffImport`, `tariffExport`, `damPriceEurMwh`, статус и predicted
datapoints. Цените във вътрешната база са EUR/MWh; тарифите в OpenRemote са
EUR/kWh.

`ElectricityProducerSolarAsset` използва GeoJSON location с ред
`[longitude, latitude]`, `pvArrays` (име, kWp, наклон, азимут), PR,
температурен коефициент, NOCT и AC limit. Open-Meteo азимутът е 0=юг,
−90=изток, +90=запад. Worker-ът пише отрицателен `powerForecast`, GTI,
дневни PV енергии и диагностика.

Никакъв token, парола, реален адрес или координати не се пазят в Git.

## English

The services discover enabled OpenRemote assets and read their attributes on
each cycle. Supplier assets publish day-ahead prices; solar assets publish
negative power forecasts, irradiance and daily PV energy. The complete
provisioning JSON contract is `schemas/site-provisioning.schema.json`.
