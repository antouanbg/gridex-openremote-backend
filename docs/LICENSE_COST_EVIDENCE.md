# License cost evidence / Доказателства за лицензни разходи

## English

Checked 2026-09-14. Scope: local staging on the existing Windows HP Z800.
**Hyper-V needs no separate hypervisor purchase with a valid Windows 10 Enterprise
license. A guarantee of no payment anywhere for the entire system is not established.**
No subscriptions, installations or license acceptance were performed.

| Component | Finding and condition | Primary evidence |
|---|---|---|
| Client Hyper-V | Included as a Windows optional feature; Windows 10 Pro/Enterprise qualify. No separate Hyper-V charge. This is not Windows Server, System Center or a license for additional Windows guests. | [Microsoft installation](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/get-started/install-hyper-v), [overview](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/overview) |
| Existing Windows | Local SoftwareLicensingProduct query returned Enterprise LicenseStatus=1 (activated). Activation does not prove purchase rights, agreement duration or ESU entitlement; no key was displayed or saved. | Local read-only observation; underlying purchase/agreement not inspected. |
| Windows 10 updates | Standard support ended 2025-10-14. Microsoft's business ESU price is USD 61/device for Year One and doubles annually, up to three years. This is an update entitlement, not a Hyper-V fee; existing qualifying entitlements may differ. Do not assume consumer free offers cover Enterprise/business use. | [Microsoft ESU](https://learn.microsoft.com/en-us/windows/whats-new/extended-security-updates) |
| Docker Desktop | No paid subscription only within qualifying categories. Commercial undertaking: fewer than 250 employees AND annual revenue below USD 10 million; government requires payment. User's qualifying category is not established. | [Binding SSA, section 4.2](https://www.docker.com/legal/docker-subscription-service-agreement/), [license summary](https://docs.docker.com/subscription-billing/desktop-license/) |
| Docker Engine/Moby | Apache-2.0 grants a no-charge, royalty-free license subject to its terms. Running Engine in Ubuntu does not require Docker Desktop. Paid cloud build, support, registry tiers and other products are separate, not prerequisites of the local design. | [Moby LICENSE](https://github.com/moby/moby/blob/master/LICENSE), [Docker FAQ](https://www.docker.com/pricing/faq/) |
| Ubuntu Server | Canonical permits free download/install/updates and internal use. Optional Pro/support is not required merely to run a local VM. Redistribution/trademarks and per-package licenses are separate. | [Canonical policy, sections 1–3](https://canonical.com/legal/intellectual-property-policy) |
| Java 21 Temurin | Adoptium supplies binaries at no cost under GPLv2 with Classpath Exception. No Oracle JDK subscription is proposed. Commercial support is optional. | [Adoptium FAQ](https://adoptium.net/docs/faq) |
| OpenRemote Manager | Can be used without a license fee under AGPLv3 conditions. Source/notice and applicable modified-network/distribution obligations must be met; the repository's MIT license does not override upstream AGPL. OpenRemote offers a commercial alternative and paid services. Exact GrideX integration/redistribution obligations are not adjudicated here. | [OpenRemote licensing](https://openremote.io/open-source/), [1.30.0 LICENSE](https://github.com/openremote/openremote/blob/1.30.0/LICENSE.txt) |
| Keycloak / PostgreSQL | Upstream Keycloak is Apache-2.0; PostgreSQL permits use without fee under its license. Custom provider and bundled dependency licenses remain applicable. | [Keycloak 26.7.3 LICENSE](https://github.com/keycloak/keycloak/blob/26.7.3/LICENSE.txt), [PostgreSQL license](https://www.postgresql.org/about/licence/) |
| TimescaleDB in OpenRemote DB image | Mixed Apache/Timescale licensing, not just PostgreSQL's license. TSL distinguishes internal/value-added use and restricts database-as-a-service offerings. No mandatory local test fee identified, but exact features, bundles and future distribution model need review. | [2.26.4 Timescale license](https://github.com/timescale/timescaledb/blob/2.26.4/tsl/LICENSE-TIMESCALE) |

No full SBOM/license audit of all native binaries, proxy packages and npm/JAR
transitives has been completed. Therefore “no fee for the identified local
components under their conditions” must not become “no licenses or obligations”.
Commercial deployment, redistribution, closed extensions and hosting are distinct
from the isolated staging use reviewed here.

If zero additional container-platform license cost is a strict requirement,
the least conditional candidate is existing licensed Windows + included Hyper-V
+ Ubuntu + Docker Engine + community components under their licenses. This
avoids Desktop's size/revenue gate, but does not remove potential Windows ESU
costs. Desktop remains an option if its free-use conditions are established.
Neither route has been installed or selected as a final architecture change.

The CPU claim has separate evidence: Manager 1.30.0's tagged Dockerfile selects
UBI 10; the retrieved amd64 config identifies UBI 10 and the matching release
commit; Red Hat documents the v3 baseline; local AVX/AVX2 probes were false.
See [CPU research](X5660_BACKEND_OPTIONS.md) and [metadata](CPU_IMAGE_METADATA.json).
This establishes a requirements mismatch, **not an observed startup failure**.
Neither the original nor rebased image has passed a real startup here.

## Български

Проверено 2026-09-14. Обхват: локален staging на наличния Windows HP Z800.
**Hyper-V не изисква отделна покупка при валиден Windows 10 Enterprise лиценз.
Не е доказана гаранция, че никъде няма да има плащане за цялата система.**
Няма абонаменти, инсталации или приемане на лицензи.

| Компонент | Извод и условие | Първични доказателства |
|---|---|---|
| Client Hyper-V | Включен Windows optional feature за Windows 10 Pro/Enterprise. Без отделна Hyper-V такса. Не е Windows Server/System Center или лиценз за допълнителни Windows guests. | [Microsoft инсталация](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/get-started/install-hyper-v), [overview](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/overview) |
| Наличният Windows | Локалният SoftwareLicensingProduct върна Enterprise LicenseStatus=1 (активиран). Активацията не доказва purchase rights, срок на договора или ESU права; ключ не е показван/записван. | Локална read-only проверка; договорът/покупката не са прегледани. |
| Windows 10 updates | Стандартната поддръжка приключи на 2025-10-14. Business ESU е USD 61/устройство за първа година и се удвоява годишно до три години. Това е право за updates, не Hyper-V такса; налични права може да се различават. Consumer free предложения не се приемат автоматично за Enterprise/business. | [Microsoft ESU](https://learn.microsoft.com/en-us/windows/whats-new/extended-security-updates) |
| Docker Desktop | Без платен абонамент само в допустимите категории. Commercial undertaking: под 250 служители И под USD 10 милиона годишен оборот; government изисква плащане. Категорията на потребителя не е установена. | [SSA, раздел 4.2](https://www.docker.com/legal/docker-subscription-service-agreement/), [обобщение](https://docs.docker.com/subscription-billing/desktop-license/) |
| Docker Engine/Moby | Apache-2.0 дава no-charge/royalty-free лиценз при условията му. Engine в Ubuntu не изисква Desktop. Платен cloud build/support/registry tiers са отделни, не prerequisites за локалния дизайн. | [Moby LICENSE](https://github.com/moby/moby/blob/master/LICENSE), [Docker FAQ](https://www.docker.com/pricing/faq/) |
| Ubuntu Server | Canonical разрешава безплатно download/install/updates и internal use. Pro/support не е задължителен за локална VM. Redistribution/trademarks и package licenses са отделни. | [Canonical policy, раздели 1–3](https://canonical.com/legal/intellectual-property-policy) |
| Java 21 Temurin | Безплатни binaries под GPLv2 с Classpath Exception. Не се предлага Oracle JDK абонамент. Commercial support е по избор. | [Adoptium FAQ](https://adoptium.net/docs/faq) |
| OpenRemote Manager | Без license fee при спазване на AGPLv3. Source/notice и приложимите modified-network/distribution задължения остават; MIT на repository не отменя AGPL. Има commercial алтернатива и платени услуги. Точните задължения на GrideX integration/redistribution не са решени тук. | [OpenRemote лицензиране](https://openremote.io/open-source/), [1.30.0 LICENSE](https://github.com/openremote/openremote/blob/1.30.0/LICENSE.txt) |
| Keycloak / PostgreSQL | Upstream Keycloak е Apache-2.0; PostgreSQL разрешава употреба без такса. Custom providers и bundled dependencies запазват собствените си лицензи. | [Keycloak 26.7.3 LICENSE](https://github.com/keycloak/keycloak/blob/26.7.3/LICENSE.txt), [PostgreSQL](https://www.postgresql.org/about/licence/) |
| TimescaleDB в OpenRemote DB image | Смесено Apache/Timescale лицензиране, не само PostgreSQL лиценз. TSL различава internal/value-added употреба и ограничава database-as-a-service. Не е открита задължителна local test такса, но точните features/bundles и бъдещият distribution модел изискват преглед. | [Timescale 2.26.4 лиценз](https://github.com/timescale/timescaledb/blob/2.26.4/tsl/LICENSE-TIMESCALE) |

Няма пълен SBOM/license audit на native binaries, proxy packages и npm/JAR
transitives. „Без такса за посочените локални компоненти при условията им“ не
означава „без лицензи/задължения“. Commercial deployment, redistribution,
затворени extensions и hosting са различни от този изолиран staging.

При строго изискване за нулев допълнителен container-platform license разход
най-малко условният кандидат е наличен лицензиран Windows + включен Hyper-V
+ Ubuntu + Docker Engine + community компоненти при техните лицензи. Отпада
Desktop size/revenue gate, но не потенциалният Windows ESU разход. Desktop остава
вариант при доказани free-use условия. Нито един път не е инсталиран или избран
като окончателна смяна на архитектурата.

CPU твърдението има отделни доказателства: tagged Dockerfile на Manager 1.30.0
избира UBI 10; полученият amd64 config сочи UBI 10 и release commit; Red Hat
документира v3 baseline; локалните AVX/AVX2 probes са false. Виж
[CPU проучването](X5660_BACKEND_OPTIONS.md) и [metadata](CPU_IMAGE_METADATA.json).
Това доказва несъответствие на изискванията, **не наблюдаван startup отказ**.
Нито оригиналният, нито rebased image са преминали реален startup тук.
