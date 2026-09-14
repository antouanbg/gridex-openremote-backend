"""Prepare local cloud disk and seed; never print credentials. / Без изход на ключове."""
from contextlib import nullcontext
import hashlib
import io
import json
from pathlib import Path
import struct
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
LOCAL = ROOT / '.local-staging' / 'cloud'
sys.path.insert(0, str(ROOT / '.local-staging' / 'cloudtools'))
import pycdlib
import yaml
from dissect.hypervisor.disk.qcow2 import QCow2
from dissect.hypervisor.disk.vhd import VHD

EXPECTED = '612b2c0cc1bc413a6cb8c38fd611794caf0f2b436c50013d8b3794db12ad7354'

def sha(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def footer(size):
    sectors = min(size // 512, 65535 * 16 * 255)
    if sectors >= 65535 * 16 * 63:
        heads, spt = 16, 255
        ch = sectors // spt
    else:
        spt = 17
        ch = sectors // spt
        heads = max(4, (ch + 1023) // 1024)
        if ch >= heads * 1024 or heads > 16:
            spt, heads = 31, 16
            ch = sectors // spt
        if ch >= heads * 1024:
            spt, heads = 63, 16
            ch = sectors // spt
    geometry = ((ch // heads) << 16) | (heads << 8) | spt
    data = bytearray(512)
    struct.pack_into('>8sIIQI4sI4sQQIII16sB', data, 0, b'conectix', 2, 0x10000,
                     0xffffffffffffffff, int(time.time())-946684800, b'grdx',
                     0x10000, b'Wi2k', size, size, geometry, 2, 0, uuid.uuid4().bytes, 0)
    struct.pack_into('>I', data, 64, (~sum(data)) & 0xffffffff)
    return data

def main():
    source = LOCAL / 'ubuntu.qcow2.partial'
    assert sha(source) == EXPECTED, 'Cloud QCOW checksum mismatch'
    image = QCow2(source)
    assert image.size % 512 == 0
    target = LOCAL / 'ubuntu-base.vhd'
    digest = hashlib.sha256()
    with (nullcontext(None) if target.exists() else target.open('xb')) as out:
        stream = image.open()
        left = image.size
        while left:
            block = stream.read(min(left, 4 * 1024 * 1024))
            if not block:
                raise RuntimeError('Unexpected QCOW EOF')
            if out is not None:
                out.write(block)
            digest.update(block)
            left -= len(block)
        if out is not None:
            out.write(footer(image.size))
    with target.open('rb') as raw:
        disk = VHD(raw)
        assert disk.size == image.size
        assert hashlib.file_digest(disk, 'sha256').hexdigest() == digest.hexdigest(), 'VHD data roundtrip failed'
    keys = LOCAL / 'keys'
    keys.mkdir(exist_ok=True)
    for name in ('client', 'host'):
        key = keys / name
        if not key.exists():
            subprocess.run(['ssh-keygen.exe', '-q', '-t', 'ed25519', '-N', '', '-C', 'gridex-staging', '-f', str(key)], check=True)
    client_public = (keys / 'client.pub').read_text(encoding='utf-8').strip()
    host_public = (keys / 'host.pub').read_text(encoding='utf-8').strip()
    (LOCAL / 'known_hosts').write_text('gridex-auto ' + host_public + '\n')
    files = []
    def add(path, content, mode='0644'):
        files.append({'path': path, 'permissions': mode, 'owner': 'root:root', 'content': content})
    add('/usr/local/sbin/gridex-bootstrap', (ROOT / 'scripts/staging/cloud-bootstrap.sh').read_text(encoding='utf-8'), '0700')
    add('/opt/gridex/scripts/staging/probe-original-images.sh', (ROOT / 'scripts/staging/probe-original-images.sh').read_text(encoding='utf-8'), '0700')
    metadata = json.loads((ROOT / 'docs/CPU_IMAGE_METADATA.json').read_text(encoding='utf-8-sig'))
    names = ['openremote/manager:1.30.0', 'openremote/keycloak:26.7.3.0', 'openremote/postgresql:17.9.0.1-slim', 'openremote/proxy:3.2.19.0', 'library/postgres:17.9-alpine', 'library/node:22-alpine']
    refs = []
    for name in names:
        item = next(x for x in metadata['images'] if x['image'] == name)
        refs.append(name.rsplit(':', 1)[0] + '@' + item['amd64Digest'])
    add('/opt/gridex/images.txt', '\n'.join(refs) + '\n')
    add('/etc/systemd/system/gridex-bootstrap.service', '''[Unit]
Description=GrideX isolated bootstrap and original image probes
Wants=network-online.target
After=network-online.target ssh.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/gridex-bootstrap
TimeoutStartSec=3600
RemainAfterExit=yes
[Install]
WantedBy=multi-user.target
''')
    add('/etc/systemd/journald.conf.d/gridex.conf', '[Journal]\nStorage=persistent\nSystemMaxUse=128M\n')
    add('/etc/sysctl.d/99-gridex-diagnostics.conf', 'kernel.panic=0\nkernel.panic_on_oops=0\n')
    add('/etc/ssh/sshd_config.d/00-gridex.conf', 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n')
    config = {
        'hostname': 'gridex-auto', 'manage_etc_hosts': True,
        'users': [{'name': 'gridex', 'groups': ['sudo'], 'shell': '/bin/bash',
                   'sudo': ['ALL=(ALL) NOPASSWD:ALL'], 'lock_passwd': True,
                   'ssh_authorized_keys': [client_public]}],
        'ssh_pwauth': False, 'disable_root': True,
        'ssh_keys': {'ed25519_private': (keys/'host').read_text(encoding='utf-8'), 'ed25519_public': host_public},
        'ssh_publish_hostkeys': {'enabled': False}, 'ssh_quiet_keygen': True,
        'package_update': False, 'package_upgrade': False,
        'write_files': files,
        'runcmd': [['systemctl', 'daemon-reload'], ['systemctl', 'enable', '--now', 'ssh'],
                    ['systemctl', 'enable', '--now', '--no-block', 'gridex-bootstrap.service']],
    }
    payloads = {
        'user-data': '#cloud-config\n' + yaml.safe_dump(config, sort_keys=False),
        'meta-data': yaml.safe_dump({'instance-id': 'gridex-auto-'+str(uuid.uuid4()), 'local-hostname': 'gridex-auto'}),
        'network-config': yaml.safe_dump({'version': 2, 'ethernets': {'staging': {'match': {'name': 'e*'}, 'dhcp4': True, 'dhcp6': False, 'accept-ra': False}}}),
    }
    seed = LOCAL / 'seed.iso'
    iso = pycdlib.PyCdlib()
    iso.new(interchange_level=3, joliet=3, rock_ridge='1.09', vol_ident='CIDATA')
    for idx, (name, content) in enumerate(payloads.items()):
        data = content.encode()
        iso.add_fp(io.BytesIO(data), len(data), iso_path=f'/FILE{idx}.;1', rr_name=name, joliet_path='/'+name)
    iso.write(str(seed))
    iso.close()
    check = pycdlib.PyCdlib()
    check.open(str(seed))
    for name, content in payloads.items():
        retrieved = io.BytesIO()
        check.get_file_from_iso_fp(retrieved, rr_path='/'+name)
        assert retrieved.getvalue() == content.encode()
        yaml.safe_load(content)
    check.close()
    report = {'qcowSHA256': EXPECTED, 'rawDataSHA256': digest.hexdigest(),
              'vhdSHA256': sha(target), 'seedSHA256': sha(seed), 'virtualSize': image.size,
              'diskRoundtrip': 'PASS', 'seedRoundtrip': 'PASS', 'runtime': 'NOT_RUN'}
    (LOCAL / 'artifact-checks.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
