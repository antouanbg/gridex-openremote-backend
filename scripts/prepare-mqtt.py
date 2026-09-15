"""Local staging PKI and per-site ACL. Never overwrite existing keys or publish inventory.
Локален staging PKI/ACL; съществуващи ключове не се презаписват, inventory не влиза в Git.
"""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

source = Path(__file__).resolve().parents[1]
target = Path.home() / 'GrideX-runtime' / 'mqtt'
os.umask(0o077)
target.mkdir(parents=True, exist_ok=True, mode=0o700)
for part in ('ca', 'server', 'clients', 'health', 'data', 'config'):
    (target / part).mkdir(exist_ok=True, mode=0o700)
inventory = target / 'sites.json'
if not inventory.exists():
    inventory.write_text(json.dumps([
        {'identity': 'lab-a', 'site': 'lab-a', 'gateway': 'gateway-a'},
        {'identity': 'lab-b', 'site': 'lab-b', 'gateway': 'gateway-b'},
    ], indent=2))
sites = json.loads(inventory.read_text())
seen = set()
bindings = set()
for site in sites:
    if any(not isinstance(site.get(k), str) or not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}', site[k]) for k in ('identity', 'site', 'gateway')):
        raise SystemExit('Invalid identity/site/gateway: only safe topic segments allowed')
    if site['identity'] in seen or site['identity'] in ('backend-reader', 'broker-health') or (site['site'], site['gateway']) in bindings:
        raise SystemExit('Duplicate/reserved identity or binding')
    seen.add(site['identity'])
    bindings.add((site['site'], site['gateway']))

def openssl(*args):
    subprocess.run(['openssl', *map(str, args)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

ca = target / 'ca'
if not (ca / 'ca.key').exists():
    if (ca / 'ca.crt').exists():
        raise SystemExit('Incomplete CA; manual recovery required')
    openssl('req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-days', '3650',
            '-subj', '/CN=GrideX Local MQTT CA', '-keyout', ca / 'ca.key', '-out', ca / 'ca.crt')
if not (ca / 'ca.crt').exists():
    raise SystemExit('Missing CA certificate')
# Explicit CA constraints are required by strict modern TLS validators.
ca_text = subprocess.check_output(['openssl', 'x509', '-in', str(ca / 'ca.crt'), '-text', '-noout'], text=True)
if 'Certificate Sign' not in ca_text:
    ext = ca / 'ca.ext'
    ext.write_text('basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n')
    openssl('req', '-new', '-key', ca / 'ca.key', '-subj', '/CN=GrideX Local MQTT CA', '-out', ca / 'ca.csr')
    openssl('x509', '-req', '-in', ca / 'ca.csr', '-signkey', ca / 'ca.key', '-days', '3650',
            '-sha256', '-extfile', ext, '-out', ca / 'ca.crt')
    (ca / 'ca.csr').unlink()
    ext.unlink()

def certificate(folder, name, identity, server=False):
    folder.mkdir(exist_ok=True, mode=0o700)
    key, crt = folder / f'{name}.key', folder / f'{name}.crt'
    if key.exists() or crt.exists():
        if not (key.exists() and crt.exists()):
            raise SystemExit('Incomplete certificate pair; manual recovery required')
        openssl('verify', '-CAfile', ca / 'ca.crt', crt)
        return
    csr = folder / f'{name}.csr'
    ext = folder / f'{name}.ext'
    ext.write_text('basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\n'
        + ('extendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost,DNS:broker,IP:127.0.0.1\n' if server else 'extendedKeyUsage=clientAuth\n'))
    openssl('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-subj', f'/CN={identity}', '-keyout', key, '-out', csr)
    openssl('x509', '-req', '-in', csr, '-CA', ca / 'ca.crt', '-CAkey', ca / 'ca.key',
            '-CAcreateserial', '-days', '90', '-sha256', '-extfile', ext, '-out', crt)
    csr.unlink()
    ext.unlink()

certificate(target / 'server', 'server', 'broker', True)
shutil.copy2(ca / 'ca.crt', target / 'server' / 'ca.crt')
certificate(target / 'health', 'client', 'broker-health')
certificate(target / 'clients' / 'backend-reader', 'client', 'backend-reader')
for site in sites:
    certificate(target / 'clients' / site['identity'], 'client', site['identity'])
acl = ['user broker-health', 'topic read $SYS/broker/uptime', '', 'user backend-reader']
for site in sites:
    prefix = f"gridex/v1/sites/{site['site']}/edge/{site['gateway']}"
    acl += [f'topic read {prefix}/health', f'topic read {prefix}/nodes/+/telemetry']
for site in sites:
    prefix = f"gridex/v1/sites/{site['site']}/edge/{site['gateway']}"
    acl += ['', f"user {site['identity']}", f'topic write {prefix}/health', f'topic write {prefix}/nodes/+/telemetry']
(target / 'config' / 'access.acl').write_text('\n'.join(acl) + '\n')
shutil.copy2(source / 'services/mqtt/mosquitto.conf', target / 'config/mosquitto.conf')
shutil.copy2(source / 'compose.mqtt.yml', target / 'compose.mqtt.yml')
(target / '.env').write_text(f'LOCAL_UID={os.getuid()}\nLOCAL_GID={os.getgid()}\n')
print('Private MQTT runtime prepared. CA is NOT mounted in broker. Enrollment of real sites remains explicit.')
