# Automated cloud VM / Автоматизирана cloud VM

## English

Run `Start-GrideX.cmd` from this checkout and accept one Windows UAC prompt.
No Ubuntu console commands are required. The launcher saves the old running
`gridex-cpu-staging` VM to preserve its session and release memory. It creates
a separate `gridex-auto` VM: Generation 2, 4 CPUs, 8 GiB fixed RAM, 80 GiB dynamic
VHDX, Secure Boot with MicrosoftUEFICertificateAuthority. It refuses to overwrite
an existing VM or directory. No BIOS changes.

Local artifacts in `.local-staging/cloud/`: verified generic Ubuntu 24.04 cloud
QCOW, converted VHD, cloud-init CIDATA ISO, SSH keys and pinned known_hosts.
Folder access is restricted to the current user, Administrators and SYSTEM.
Do not share the seed ISO: it contains local SSH host key material. No keys,
addresses, VM disks or connection files are committed. This launcher currently
requires the prepared local artifacts; a Git checkout alone is not an appliance.
Preparation dependencies are local pycdlib 1.20.0, PyYAML 6.0.3,
dissect.hypervisor 3.21 and dissect.extfs 3.15 plus their dependencies.

Network: existing internal Default Switch provides DHCP/NAT. Before attachment
and boot, 22 Hyper-V extended ACL rules deny inbound traffic by default, deny
IPv6 and outbound private/reserved destinations, allow DHCP and host DNS,
allow host-initiated SSH, and allow outbound public TCP 80/443 for provisioning.
No external switch or router forwarding is added. Address discovery and the
host-specific exceptions are local only. ACL enforcement still needs runtime
verification; creation failure leaves the new VM off and disconnected before
attachment. Later DHCP address changes can require updating the local connection
file; host Default Switch address changes require reviewing ACL exceptions.

Cloud-init configures DHCP, key-only SSH, persistent journals and an automatic
Docker bootstrap service. Docker packages are version-pinned; six original
image paths are digest-pinned. Images are pulled, then binary probes run with
no container network, published ports or host mounts. This is NOT a completed
six-service deployment: OIDC, application entrypoints, database extensions,
migrations, health, permission tests, persistence and backup/restore remain.
Manager remains the original 1.30.0. A CPU failure is recorded, not hidden by an
unreviewed rebase. `Connect-CloudVM.ps1 -Status` reads the automatic result after
successful deployment. `Connect-CloudVM.ps1` opens an SSH terminal with paste.

Evidence: upstream QCOW SHA256 and signed checksum list verified. Full raw disk
contents roundtrip through the generated VHD passed SHA256 comparison; seed ISO
contents roundtrip and YAML parse passed. PowerShell and Bash syntax passed.
Hyper-V Test-VHD runs during deployment. VM boot, DHCP, SSH, ACL and Docker/image
runtime tests have NOT_RUN status until observed. User reported a freeze/reboot
of the old VM; cause was not established by the available host event query.

Sources: [Ubuntu artifacts](https://ubuntu.com/docs/public-images/public-images-reference/artifacts/),
[image signatures](https://ubuntu.com/docs/public-images/public-images-how-to/verify-image-checksum/),
[NoCloud](https://cloudinit.readthedocs.io/en/latest/reference/datasources/nocloud.html),
[Hyper-V ACL](https://learn.microsoft.com/en-us/powershell/module/hyper-v/add-vmnetworkadapterextendedacl),
[Docker Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/).
The Azure-specific VHD was inspected/downloaded but rejected: Canonical says
it is not a general on-premises Hyper-V image. Only the generic QCOW is deployed.
Windows 10 remains temporary staging; Windows 11 remains planned production.

## Български

Стартирайте `Start-GrideX.cmd` от това checkout и приемете едно Windows UAC
потвърждение. Не са нужни команди в Ubuntu конзолата. Launcher-ът запазва
сесията на старата работеща `gridex-cpu-staging` чрез Save, за да освободи RAM.
Създава отделна `gridex-auto` VM: Generation 2, 4 CPU, фиксирани 8 GiB RAM,
динамичен VHDX 80 GiB, Secure Boot с MicrosoftUEFICertificateAuthority. Отказва
презаписване на съществуваща VM или папка. Без BIOS промени.

Локални файлове в `.local-staging/cloud/`: проверен общ Ubuntu 24.04 cloud QCOW,
преобразуван VHD, cloud-init CIDATA ISO, SSH ключове и фиксиран known_hosts.
Папката е ограничена до текущия потребител, Administrators и SYSTEM.
Не споделяйте seed ISO: съдържа локалния SSH host ключ. Ключове, адреси, VM дискове
и connection файлове не се commit-ват. Launcher-ът изисква подготвените локални
файлове; само Git checkout не е готова appliance. Подготовката използва локални
pycdlib 1.20.0, PyYAML 6.0.3, dissect.hypervisor 3.21 и dissect.extfs 3.15 и
техните зависимости.

Мрежа: съществуващият internal Default Switch предоставя DHCP/NAT. Преди
свързване и boot 22 Hyper-V extended ACL правила забраняват inbound по подразбиране,
IPv6 и outbound private/reserved дестинации; разрешават DHCP, DNS през host,
SSH започнат от host и outbound public TCP 80/443 за provisioning.
Без external switch или router forwarding. Откриването на адреси и изключенията
за host са само локални. ACL enforcement още изисква runtime проверка; отказ при
създаване оставя новата VM изключена и несвързана преди attachment. Промяна на
DHCP адреса може да изисква обновяване на локалния connection файл; промяна на
host Default Switch адреса изисква преглед на ACL изключенията.

Cloud-init настройва DHCP, SSH само с ключ, постоянен journal и автоматична
Docker bootstrap услуга. Docker packages са с фиксирани версии; шестте
оригинални image paths са с фиксирани digests. Images се изтеглят, после binary
probes работят без container мрежа, публикувани портове или host mounts.
Това НЕ е завършено разгръщане на шестте услуги: остават OIDC, application
entrypoints, database extensions, миграции, health, права, persistence и
backup/restore. Manager остава оригиналният 1.30.0. CPU отказ се записва, без
автоматична смяна на базата без преглед. `Connect-CloudVM.ps1 -Status` чете
автоматичния резултат след deployment. `Connect-CloudVM.ps1` отваря SSH с paste.

Доказателства: upstream QCOW SHA256 и подписаният checksum списък са проверени.
Пълното raw disk съдържание след преобразуване във VHD премина SHA256 сравнение;
seed ISO съдържанието и YAML parse също са проверени. PowerShell и Bash синтаксис
PASS. Hyper-V Test-VHD се изпълнява при deployment. VM boot, DHCP, SSH, ACL и
Docker/image runtime тестовете са NOT_RUN до наблюдаван резултат. Потребителят
съобщи за freeze/reboot на старата VM; достъпната host event проверка не установи
причина.

Източници: [Ubuntu artifacts](https://ubuntu.com/docs/public-images/public-images-reference/artifacts/),
[image signatures](https://ubuntu.com/docs/public-images/public-images-how-to/verify-image-checksum/),
[NoCloud](https://cloudinit.readthedocs.io/en/latest/reference/datasources/nocloud.html),
[Hyper-V ACL](https://learn.microsoft.com/en-us/powershell/module/hyper-v/add-vmnetworkadapterextendedacl),
[Docker Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/).
Azure-specific VHD е прегледан/изтеглен, но отхвърлен: Canonical посочва, че не е
общ on-premises Hyper-V image. Разгръща се само общият QCOW. Windows 10 остава
временен staging; Windows 11 остава планиран production.