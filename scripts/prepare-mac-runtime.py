"""Prepare a private, non-synced runtime copy; never print credentials.

Подготвя локално копие извън синхронизираните папки, без печат на тайни.
"""
import os
from pathlib import Path
import secrets
import shutil

source = Path(__file__).resolve().parents[1]
target = Path.home() / 'GrideX-runtime' / 'backend'
target.mkdir(parents=True, exist_ok=True, mode=0o700)
os.chmod(target, 0o700)
env = target / '.env'
if not env.exists():
    with open(env, 'x', opener=lambda p, f: os.open(p, f, 0o600)) as stream:
        for key in ('OR_ADMIN_PASSWORD', 'OR_DATABASE_PASSWORD',
                    'GRIDEX_DATABASE_PASSWORD', 'OPENREMOTE_SERVICE_CLIENT_SECRET'):
            stream.write(f'{key}={secrets.token_hex(32)}\n')
# Additional enrollment credential stays private and existing values are preserved.
existing_keys = {line.split('=', 1)[0] for line in env.read_text().splitlines() if '=' in line}
if 'GRIDEX_ENROLLMENT_CLIENT_SECRET' not in existing_keys:
    with open(env, 'a') as stream:
        stream.write(f'\nGRIDEX_ENROLLMENT_CLIENT_SECRET={secrets.token_hex(32)}\n')
os.chmod(env, 0o600)
shutil.copy2(source / 'compose.mac.yml', target / 'compose.mac.yml')
shutil.copytree(source / 'services' / 'gridex-api', target / 'services' / 'gridex-api',
                dirs_exist_ok=True, ignore=shutil.ignore_patterns('node_modules', '.env'))
print('Private runtime copy prepared; credentials preserved and not displayed.')
