"""Prepare loopback-only HTTPS testing. Never issues a publicly trusted certificate.
Подготовка само за loopback HTTPS тест, без публично доверен сертификат.
"""
import argparse
import os
from pathlib import Path
import re
import shutil
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--api-host', required=True)
parser.add_argument('--auth-host', required=True)
args = parser.parse_args()
for host in (args.api_host, args.auth_host):
    if not re.fullmatch(r'[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)+', host):
        parser.error('Invalid DNS hostname')
if args.api_host == args.auth_host:
    parser.error('API/auth hosts must differ')
os.umask(0o077)
root = Path(__file__).resolve().parents[1]
target = Path.home() / 'GrideX-runtime' / 'public-https-test'
target.mkdir(parents=True, exist_ok=True, mode=0o700)
certs = target / 'certs'
certs.mkdir(exist_ok=True, mode=0o700)
crt, key = certs / 'fullchain.pem', certs / 'privkey.pem'
if crt.exists() != key.exists():
    raise SystemExit('Incomplete certificate pair; inspect manually')
if not crt.exists():
    config = certs / 'test.cnf'
    config.write_text(f'''[req]
distinguished_name=dn
x509_extensions=ext
prompt=no
[dn]
CN={args.api_host}
[ext]
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:{args.api_host},DNS:{args.auth_host}
''')
    subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
                    '-days', '7', '-config', str(config), '-keyout', str(key),
                    '-out', str(crt)], check=True, stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL)
    config.unlink()
template = (root / 'deploy/public-https/nginx.conf.template').read_text()
(target / 'nginx.conf').write_text(template.replace('${API_HOST}', args.api_host).replace('${AUTH_HOST}', args.auth_host))
shutil.copy2(root / 'deploy/public-https/compose.yml', target / 'compose.yml')
(target / '.env').write_text(
    'PUBLIC_PROXY_IMAGE=nginx@sha256:dc5069ad14f19660b141b21236140b91656bf89bbc3e2417c70ae650cd66104c\n'
    f'LOCAL_UID={os.getuid()}\nLOCAL_GID={os.getgid()}\n'
    'PUBLIC_BIND_IP=127.0.0.1\nPUBLIC_HTTPS_PORT=14443\n')
print('Prepared loopback 14443 with short-lived TEST certificate; not public TLS.')
