"""Real MQTT v5/mTLS loopback acceptance; synthetic lab-a/lab-b only.
Реален MQTT v5/mTLS тест, само синтетични обекти. Includes broker restart.
"""
from pathlib import Path
import socket
import ssl
import struct
import subprocess
import time
import uuid

root = Path.home() / 'GrideX-runtime/mqtt'

def text(value):
    data = value.encode()
    return struct.pack('!H', len(data)) + data

def packet(kind, body):
    remaining = len(body)
    length = bytearray()
    while True:
        digit = remaining % 128
        remaining //= 128
        length.append(digit | (128 if remaining else 0))
        if not remaining:
            return bytes([kind]) + bytes(length) + body

def receive(sock):
    def exact(count):
        result = b''
        while len(result) < count:
            part = sock.recv(count-len(result))
            if not part:
                raise ConnectionError('Connection closed')
            result += part
        return result
    kind = exact(1)[0]
    size, multiplier = 0, 1
    while True:
        digit = exact(1)[0]
        size += (digit & 127) * multiplier
        if not digit & 128:
            break
        multiplier *= 128
    return kind, exact(size)

def connect(identity=None, hostname='localhost'):
    ctx = ssl.create_default_context(cafile=str(root / 'server/ca.crt'))
    if identity:
        folder = root / 'clients' / identity
        ctx.load_cert_chain(folder / 'client.crt', folder / 'client.key')
    raw = socket.create_connection(('127.0.0.1', 8883), timeout=4)
    try:
        sock = ctx.wrap_socket(raw, server_hostname=hostname)
        sock.sendall(packet(0x10, text('MQTT') + bytes([5, 2, 0, 30, 0]) + text('test-' + uuid.uuid4().hex)))
        kind, body = receive(sock)
        assert kind == 0x20 and body[1] == 0, 'CONNECT refused'
        return sock
    except BaseException:
        raw.close()
        raise

def publish(sock, topic, payload, retained=False):
    sock.sendall(packet(0x32 | int(retained), text(topic) + b'\x00\x01\x00' + payload))
    kind, body = receive(sock)
    assert kind == 0x40, 'Expected PUBACK'
    return body[2] if len(body) > 2 else 0

def subscribe(sock, topic):
    sock.sendall(packet(0x82, b'\x00\x02\x00' + text(topic) + b'\x00'))
    kind, body = receive(sock)
    assert kind == 0x90, 'Expected SUBACK'
    return body[-1]

def expect_message(sock, payload):
    kind, body = receive(sock)
    assert kind >> 4 == 3 and body.endswith(payload), 'Missing expected telemetry'

for identity, hostname in [(None, 'localhost'), ('lab-a', 'wrong.invalid')]:
    try:
        sock = connect(identity, hostname)
    except (ssl.SSLError, ConnectionError, OSError):
        print('PASS rejected missing client certificate or incorrect server hostname')
    else:
        sock.close()
        raise AssertionError('Invalid TLS identity accepted')

topic_a = 'gridex/v1/sites/lab-a/edge/gateway-a/health'
topic_b = 'gridex/v1/sites/lab-b/edge/gateway-b/health'
marker = ('synthetic-' + uuid.uuid4().hex).encode()
with connect('backend-reader') as reader, connect('lab-a') as a, connect('lab-b') as b:
    assert subscribe(reader, topic_a) < 128
    assert publish(a, topic_a, marker, True) < 128
    expect_message(reader, marker)
    assert publish(a, topic_b, marker) == 135
    assert publish(b, topic_a, marker) == 135
    assert publish(reader, topic_a, marker) == 135
    assert publish(a, 'gridex/v1/sites/lab-a/commands/power', marker) == 135
    print('PASS own telemetry received; cross-site, reader write and commands rejected')
with connect('lab-a') as a, connect('lab-b') as b:
    subscribe(a, topic_b)
    assert publish(b, topic_b, marker) < 128
    a.settimeout(1)
    try:
        receive(a)
        raise AssertionError('Site A received site B data')
    except socket.timeout:
        print('PASS site cannot read foreign telemetry')

subprocess.run(['docker', '--context', 'colima-gridex', 'restart', 'gridex-mqtt-broker-1'], check=True, stdout=subprocess.DEVNULL)
for attempt in range(10):
    try:
        reader = connect('backend-reader')
        break
    except OSError:
        time.sleep(0.5)
else:
    raise AssertionError('Broker did not recover')
with reader:
    assert subscribe(reader, topic_a) < 128
    expect_message(reader, marker)
with connect('lab-a') as a:
    assert publish(a, topic_a, b'', True) < 128
print('PASS broker restart, reconnect and persistent retained telemetry; synthetic retained marker cleared')
