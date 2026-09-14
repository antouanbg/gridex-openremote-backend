# Creates and boots only a new offline VM. / Създава и стартира само нова VM без мрежа.
[CmdletBinding(SupportsShouldProcess)]
param()
$ErrorActionPreference = 'Stop'
$name = 'gridex-cpu-staging'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$iso = Join-Path $root '.local-staging\downloads\ubuntu-24.04.5-live-server-amd64.iso'
$directory = Join-Path $root '.local-staging\vm'
$expected = '97f3d7ffb032c3eb3b23d2c8be9cc76e60c2c1f2c0146ba5ba9fe01cafae0fd8'
$null = Get-VM -ErrorAction Stop
if (Get-VM -Name $name -ErrorAction SilentlyContinue) { throw 'VM already exists / VM вече съществува.' }
if (Test-Path -LiteralPath $directory) { throw 'VM directory already exists; inspect manually / Папката за VM съществува; проверете я ръчно.' }
if ((Get-FileHash -LiteralPath $iso -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'ISO checksum failed / Невалиден ISO checksum.' }
if ((Get-Volume -DriveLetter C).SizeRemaining -lt 100GB) { throw 'Need 100 GiB free on C / Нужни са 100 GiB свободни на C.' }
if ((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory -lt (10GB / 1KB)) { throw 'Need 10 GiB free RAM / Нужни са 10 GiB свободна RAM.' }
if ($PSCmdlet.ShouldProcess($name, 'Create and boot Gen2 VM: 4 CPU, 8 GiB RAM, 80 GiB dynamic disk, NO network / Създаване и старт без мрежа')) {
    New-Item -ItemType Directory -Path $directory | Out-Null
    New-VM -Name $name -Generation 2 -MemoryStartupBytes 8GB -NewVHDPath (Join-Path $directory 'ubuntu.vhdx') -NewVHDSizeBytes 80GB -Path $directory | Out-Null
    Get-VMNetworkAdapter -VMName $name | Remove-VMNetworkAdapter
    Set-VMProcessor -VMName $name -Count 4
    Set-VMMemory -VMName $name -DynamicMemoryEnabled $false
    Set-VM -Name $name -AutomaticCheckpointsEnabled $false -AutomaticStartAction Nothing -AutomaticStopAction ShutDown
    Set-VMFirmware -VMName $name -EnableSecureBoot On -SecureBootTemplate MicrosoftUEFICertificateAuthority
    $dvd = Add-VMDvdDrive -VMName $name -Path $iso -Passthru
    Set-VMFirmware -VMName $name -FirstBootDevice $dvd
    if (@(Get-VMNetworkAdapter -VMName $name).Count -ne 0) { throw 'Unexpected network adapter / Неочаквана мрежова карта.' }
    Start-VM -Name $name
    Write-Output 'VM boot requested; Linux success NOT verified / Заявен старт на VM; Linux НЕ е потвърден.'
}
