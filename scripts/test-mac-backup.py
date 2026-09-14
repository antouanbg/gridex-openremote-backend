"""Non-destructive local database backup/restore rehearsal; never print secrets.
Локален backup/restore тест без промяна на изходните бази и без печат на тайни.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import time

os.umask(0o077)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
root = Path.home() / 'GrideX-runtime' / 'backups' / stamp
root.mkdir(parents=True, mode=0o700)
docker = ['docker', '--context', 'colima-gridex']
def run(*args, **kwargs):
    return subprocess.run(docker + list(args), check=True, **kwargs)
def out(*args):
    return subprocess.check_output(docker + list(args), text=True).strip()
report = {'timestamp': stamp, 'databases': [], 'note': 'DB logical consistency only; live volume archives not application-consistent'}
for source, user, dbname in [('gridex-mac-gridex-db-1', 'gridex', 'gridex'),
                             ('gridex-mac-postgresql-1', 'postgres', 'openremote')]:
    dump = root / (dbname + '.sql')
    with dump.open('xb') as stream:
        run('exec', source, 'pg_dumpall', '-U', user, stdout=stream)
    image = out('inspect', '-f', '{{.Config.Image}}', source)
    target = 'gridex-restore-' + dbname + '-' + stamp.lower()
    env = os.environ.copy()
    env['POSTGRES_PASSWORD'] = secrets.token_hex(32)
    run('run', '-d', '--name', target, '--network', 'none',
        '-e', 'POSTGRES_USER=restore_admin', '-e', 'POSTGRES_DB=restore_admin',
        '-e', 'POSTGRES_PASSWORD', '-v', target + ':/var/lib/postgresql/data',
        image, env=env, stdout=subprocess.DEVNULL)
    try:
        for attempt in range(60):
            ready = subprocess.run(docker + ['exec', target, 'pg_isready', '-U', 'restore_admin', '-d', 'restore_admin'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if ready.returncode == 0: break
            time.sleep(1)
        else: raise RuntimeError('Restore database did not become ready')
        with dump.open('rb') as stream, (root / (dbname + '-restore.log')).open('xb') as log:
            run('exec', '-i', target, 'psql', '-U', 'restore_admin', '-d', 'restore_admin', '-v', 'ON_ERROR_STOP=1', stdin=stream, stdout=log, stderr=log)
        tables = "SELECT schemaname||'.'||tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY 1"
        src_tables = out('exec', source, 'psql', '-U', user, '-d', dbname, '-Atc', tables)
        dst_tables = out('exec', target, 'psql', '-U', 'restore_admin', '-d', dbname, '-Atc', tables)
        if src_tables != dst_tables: raise RuntimeError('Restored table inventory differs')
        report['databases'].append({'database': dbname, 'restored': True, 'tables': len(src_tables.splitlines()), 'sha256': hashlib.sha256(dump.read_bytes()).hexdigest(), 'restore_container': target})
    finally:
        run('stop', target, stdout=subprocess.DEVNULL)
    print(dbname + ': dump and strict restore passed; table inventory matches; test container stopped')
with (root / 'report.json').open('x') as stream:
    json.dump(report, stream, indent=2)
print('Protected backups:', root)
print('Source containers untouched; restore volumes retained. Live data equality and application-volume restore are separate checks.')
