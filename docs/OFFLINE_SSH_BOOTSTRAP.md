# Offline SSH bootstrap / SSH инсталация без интернет

## English

The verified Ubuntu Server 24.04.5 ISO contains openssh-server and
openssh-sftp-server 1:9.6p1-3ubuntu13.19, libwrap0 and ncurses-term. This was
confirmed by reading its actual archive and package index on Windows, not by
assuming internet access. Guest installation and dependency resolution remain
untested. Use the original verified ISO as an APT CD-ROM source; do not enable
unauthenticated packages or download from arbitrary mirrors.

User has installed and rebooted Ubuntu successfully. The user created a separate
internal switch, connected eth0, configured a temporary guest address, and
reported successful ping to Windows. Addresses are deliberately omitted from
Git. No NAT/default route was configured in this workflow. SSH service was not
found; an online APT attempt failed with name resolution errors.

First, in administrator Windows PowerShell, reattach the existing ISO:

```powershell
Set-VMDvdDrive -VMName "gridex-cpu-staging" -Path "C:\GrideX\gridex-openremote-backend\.local-staging\downloads\ubuntu-24.04.5-live-server-amd64.iso"
```

Then run one command at a time in Ubuntu, checking each result:

```bash
sudo mount /dev/sr0 /mnt
sudo apt-cdrom -m -d=/mnt add
sudo apt install openssh-server
```

The last command may fail if a required dependency/version is absent locally;
report its exact package names and stop. Do not bypass dependency or signature
checks. Installation can start the SSH service on the isolated interface;
verify service state and Windows connectivity afterward. Do not connect an
external switch, add a default route/NAT, or expose SSH publicly. Keep passwords
and keys local. Persistent guest networking and Android access are later steps.
Docker and the original OpenRemote Manager 1.30.0 remain untested.

## Български

Провереният Ubuntu Server 24.04.5 ISO съдържа openssh-server и
openssh-sftp-server 1:9.6p1-3ubuntu13.19, libwrap0 и ncurses-term. Това е
потвърдено чрез действителния архив и package index от Windows, а не чрез
предположение за интернет достъп. Инсталацията и dependency resolution в guest
още не са тествани. Използва се оригиналният проверен ISO като APT CD-ROM
източник; без unauthenticated packages или произволни mirrors.

Потребителят успешно инсталира и рестартира Ubuntu. Създаде отделен internal
switch, свърза eth0, зададе временен guest адрес и съобщи за успешен ping до
Windows. Адресите умишлено не се записват в Git. В този workflow не са
конфигурирани NAT/default route. SSH услугата не е намерена; online APT опитът
отказа с name resolution грешки.

Първо в администраторския Windows PowerShell се връща съществуващият ISO:

```powershell
Set-VMDvdDrive -VMName "gridex-cpu-staging" -Path "C:\GrideX\gridex-openremote-backend\.local-staging\downloads\ubuntu-24.04.5-live-server-amd64.iso"
```

После по една команда в Ubuntu, с проверка на всеки резултат:

```bash
sudo mount /dev/sr0 /mnt
sudo apt-cdrom -m -d=/mnt add
sudo apt install openssh-server
```

Последната команда може да откаже при липсваща локална dependency/версия;
докладват се точните package names и се спира. Не се заобикалят dependency или
signature проверки. Инсталацията може да стартира SSH върху изолирания
интерфейс; после се проверяват service state и достъпът от Windows. Без external
switch, default route/NAT или публичен SSH. Паролите и ключовете остават локални.
Постоянната guest мрежова настройка и Android достъпът са следващи стъпки.
Docker и оригиналният OpenRemote Manager 1.30.0 остават нетествани.
