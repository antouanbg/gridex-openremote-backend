"""One-time pilot activation on ROCK; preserves network config and control locks."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout

def validate_locked_configuration(text):
    required_gates = {'GRIDEX_APPROVE_ADDRESSING', 'GRIDEX_APPROVE_POWER_SIGN',
                      'GRIDEX_APPROVE_SCALING', 'GRIDEX_APPROVE_INT32_WORD_ORDER'}
    gates = re.findall(r'^[ \t]*(GRIDEX_APPROVE_[A-Z0-9_]+)=(.*)$', text, re.M)
    names = [name for name, _ in gates]
    if not required_gates.issubset(names) or len(names) != len(set(names)):
        raise ValueError('Required commissioning gates missing or duplicated')
    if any(value.strip() not in ('0', '"0"', "'0'") for _, value in gates):
        raise ValueError('All commissioning approvals must remain explicitly zero')

if os.geteuid() != 0 or len(sys.argv) != 3:
    raise SystemExit('Usage: sudo python3 activate-rock-mqtt.py settings.json IMAGE_PAYLOAD_DIRECTORY')
settings = json.loads(Path(sys.argv[1]).read_text())
required = {'GRIDEX_SITE_ID', 'GRIDEX_GATEWAY_ID', 'GRIDEX_MQTT_BROKER_URL',
            'GRIDEX_MQTT_TOPIC_PREFIX', 'GRIDEX_MQTT_CLIENT_ID', 'GRIDEX_MQTT_CA_FILE',
            'GRIDEX_MQTT_CLIENT_CERT_FILE', 'GRIDEX_MQTT_CLIENT_KEY_FILE',
            'GRIDEX_HEALTH_PUBLISH_SECONDS', 'GRIDEX_NODE_TELEMETRY_PUBLISH_SECONDS'}
if set(settings) != required or any(not isinstance(v, str) or not re.fullmatch(r'[A-Za-z0-9_./:-]+', v) for v in settings.values()):
    raise SystemExit('Invalid scoped settings bundle')
if not settings['GRIDEX_MQTT_BROKER_URL'].startswith('mqtts://'):
    raise SystemExit('TLS required')
env = Path('/etc/gridex/gridex-rockpie.env')
original = env.read_text()
try:
    validate_locked_configuration(original)
except ValueError as error:
    raise SystemExit(str(error))
stage = Path(sys.argv[2]).resolve()
binary = stage / 'rootfs/usr/local/bin/gridex_rockpie_service'
run('sha256sum', '-c', str(stage / 'service.sha256'))
linked = run('ldd', str(binary))
if 'libmosquitto' not in linked or 'not found' in linked:
    raise SystemExit('MQTT runtime library unavailable')
crt, ca, key = (settings[k] for k in ('GRIDEX_MQTT_CLIENT_CERT_FILE', 'GRIDEX_MQTT_CA_FILE', 'GRIDEX_MQTT_CLIENT_KEY_FILE'))
run('openssl', 'verify', '-purpose', 'sslclient', '-CAfile', ca, crt)
if run('openssl', 'x509', '-in', crt, '-pubkey', '-noout') != run('openssl', 'pkey', '-in', key, '-pubout'):
    raise SystemExit('Certificate/key mismatch')
for p in (crt, ca, key):
    run('runuser', '-u', 'gridex', '--', 'test', '-r', p)
target = Path('/usr/local/bin/gridex_rockpie_service')
backup = Path(tempfile.mkdtemp(prefix='gridex-mqtt-', dir='/var/backups'))
shutil.copy2(env, backup / 'device.env')
shutil.copy2(target, backup / 'service')
next_env = original
for k, v in settings.items():
    next_env = re.sub(r'^' + re.escape(k) + r'=.*(?:\n|$)', '', next_env, flags=re.M)
    next_env = next_env.rstrip() + '\n' + k + '=' + v + '\n'
def replace_file(destination, content=None, source=None):
    stat = destination.stat()
    fd, name = tempfile.mkstemp(prefix='.gridex-', dir=destination.parent)
    try:
        os.close(fd)
        if source is not None:
            shutil.copyfile(source, name)
        else:
            Path(name).write_text(content)
        os.chmod(name, stat.st_mode & 0o777)
        os.chown(name, stat.st_uid, stat.st_gid)
        os.replace(name, destination)
    finally:
        if os.path.exists(name):
            os.unlink(name)
try:
    run('systemctl', 'stop', 'gridex-rockpie')
    replace_file(target, source=binary)
    replace_file(env, content=next_env)
    run('systemctl', 'start', 'gridex-rockpie')
    run('systemctl', 'is-active', '--quiet', 'gridex-rockpie')
except Exception:
    replace_file(target, source=backup / 'service')
    replace_file(env, source=backup / 'device.env')
    subprocess.run(['systemctl', 'restart', 'gridex-rockpie'], check=False)
    raise SystemExit('Activation failed; restored previous binary/config. Backup: ' + str(backup))
print('ROCK_MQTT_STARTED; backend receipt still requires verification. Backup: ' + str(backup))
