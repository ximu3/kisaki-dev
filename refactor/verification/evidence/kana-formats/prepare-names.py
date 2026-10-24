"""Derive header-only name cases from one pinned RAR5 payload without running a compressor."""
from pathlib import Path
import binascii
import hashlib
import json
import struct
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-formats'
DEST = CACHE / 'names'
DEST.mkdir(exist_ok=True)
sys.path.insert(0, str(HERE.parent / 'kana-rar'))
from record import write_receipt
base = ROOT / 'node_modules/.cache/kana-rar-members/fixtures/rar5-hlink.rar'
data = base.read_bytes()
def vint(data, position):
    value = shift = 0
    while True:
        byte = data[position]; position += 1
        value |= (byte & 127) << shift
        if byte < 128: return value, position
        shift += 7
        if shift > 63: raise RuntimeError('Invalid fixture varint')
def encoded(value):
    result = bytearray()
    while value >= 128:
        result.append((value & 127) | 128); value >>= 7
    result.append(value)
    return bytes(result)
blocks = []
position = 8
while position < len(data):
    size, body = vint(data, position + 4)
    end = body + size
    kind, cursor = vint(data, body)
    flags, cursor = vint(data, cursor)
    extra = payload = 0
    if flags & 1: extra, cursor = vint(data, cursor)
    if flags & 2: payload, cursor = vint(data, cursor)
    blocks.append({'start': position, 'body': body, 'end': end, 'payload': payload, 'kind': kind, 'cursor': cursor})
    position = end + payload
first = next(block for block in blocks if block['kind'] == 2)
cursor = first['cursor']
file_flags, cursor = vint(data, cursor)
for _ in range(2): _, cursor = vint(data, cursor)
if file_flags & 2: cursor += 4
if file_flags & 4: cursor += 4
_, cursor = vint(data, cursor)
host_at = cursor
_, cursor = vint(data, cursor)
name_size_at = cursor
old_size, name_at = vint(data, cursor)
cases = [
    ('unicode', '表だよ/😀.png'.encode(), 1, '表だよ/😀.png', None),
    ('unix-backslash', b'a\\b.png', 1, 'a\\b.png', None),
    ('windows-backslash', b'a\\b.png', 0, None, 'invalidName'),
    ('embedded-nul', b'a\x00b.png', 1, None, 'invalidName'),
    ('invalid-utf8', b'a\xc0\xaf.png', 1, None, 'invalidEncoding'),
    ('absolute', b'/outside.png', 1, None, 'outsideArchive'),
    ('parent-escape', b'../outside.png', 1, None, 'outsideArchive'),
    ('percent-literal', b'pages/%2e%2e.png', 1, 'pages/%2e%2e.png', None),
    ('composed', 'é.png'.encode(), 1, 'é.png', None),
    ('decomposed', 'é.png'.encode(), 1, 'é.png', None),
    ('drive-path', b'C:/outside.png', 0, None, 'outsideArchive'),
    ('windows-reserved', b'CON.png', 0, 'CON.png', None),
    ('mapped-unix-bytes', 'raw\ue082\ufffe.png'.encode(), 1, 'raw\ue082\ufffe.png', None),
    ('oversized-name-length', b'a', 1, None, 'nameTruncated')
]
records = []
for name, raw, host, expected, reason in cases:
    declared = len(raw) + (2**32 if name == 'oversized-name-length' else 0)
    body = data[first['body']:host_at] + encoded(host) + encoded(declared) + raw + data[name_at + old_size:first['end']]
    header = encoded(len(body)) + body
    replacement = struct.pack('<I', binascii.crc32(header)) + header + data[first['end']:first['end'] + first['payload']]
    output = data[:8] + b''.join(replacement if block is first else data[block['start']:block['end'] + block['payload']]
                               for block in blocks if block['kind'] != 2 or block is first)
    file = DEST / (name + '.rar')
    file.write_bytes(output)
    records.append({'name': file.name, 'expected': expected, 'reason': reason, 'sourceBytes': list(raw), 'host': host,
                    'bytes': len(output), 'sha256': hashlib.sha256(output).hexdigest()})
write_receipt(HERE / 'names-fixture-input.json', {'base': 'rar5-hlink.rar', 'baseSha256': hashlib.sha256(data).hexdigest(),
    'mutation': 'Keep the first regular payload; replace its host/name fields and CRC; remove the two reference-only members',
    'commercialCompressorExecuted': False, 'cases': records})
print(json.dumps({'derivedArchives': len(records)}))
