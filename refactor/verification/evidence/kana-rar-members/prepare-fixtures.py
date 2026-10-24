"""Pin reference fixtures and create one metadata-only hardlink-to-copy variant."""
from pathlib import Path
from datetime import datetime, timezone
import binascii
import hashlib
import json
import struct
import sys
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(HERE.parent / 'kana-rar'))
from record import write_receipt

CACHE = ROOT / 'node_modules/.cache/kana-rar-members'
FIXTURES = CACHE / 'fixtures'
FIXTURES.mkdir(parents=True, exist_ok=True)
COMMIT = '60c8513276ea462c39822db487c10111b9039442'
BASE = f'https://raw.githubusercontent.com/markokr/rarfile/{COMMIT}/'
records = []
for name in ['rar3-symlink-unix.rar', 'rar5-symlink-unix.rar', 'rar5-symlink-win.rar',
             'rar5-hlink.rar', 'rar5-evil-symlink-traversal.rar']:
    for suffix in ['', '.exp']:
        url = BASE + 'test/files/' + name + suffix
        data = urllib.request.urlopen(url, timeout=30).read()
        (FIXTURES / (name + suffix)).write_bytes(data)
        records.append({'name': name + suffix, 'source': url, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
for name in ['LICENSE', 'test/test_extract.py', 'test/test_format.py']:
    data = urllib.request.urlopen(BASE + name, timeout=30).read()
    (CACHE / name.split('/')[-1]).write_bytes(data)
    records.append({'name': name, 'source': BASE + name, 'sha256': hashlib.sha256(data).hexdigest()})

data = bytearray((FIXTURES / 'rar5-hlink.rar').read_bytes())
def vint(position):
    value = shift = 0
    while True:
        byte = data[position]
        position += 1
        value |= (byte & 127) << shift
        if byte < 128: return value, position
        shift += 7
        if shift > 63: raise RuntimeError('Unexpected fixture varint')

position = 8
changes = 0
while position < len(data):
    size, body = vint(position + 4)
    end = body + size
    kind, cursor = vint(body)
    flags, cursor = vint(cursor)
    extra = payload = 0
    if flags & 1: extra, cursor = vint(cursor)
    if flags & 2: payload, cursor = vint(cursor)
    if kind == 2 and extra:
        cursor = end - extra
        while cursor < end:
            length, content = vint(cursor)
            extra_kind, value = vint(content)
            if extra_kind == 5 and data[value] == 4:
                data[value] = 5
                changes += 1
            cursor = content + length
        struct.pack_into('<I', data, position, binascii.crc32(data[position + 4:end]))
    position = end + payload
assert changes == 2
(FIXTURES / 'rar5-filecopy.rar').write_bytes(data)
write_receipt(HERE / 'fixture-input.json', {'checkedAt': datetime.now(timezone.utc).isoformat(),
    'rarfileCommit': COMMIT, 'inputs': records, 'derivedCopy': {'base': 'rar5-hlink.rar', 'metadataChanges': changes,
    'mutation': 'Change redirection kind 4 to 5 and recompute affected header CRC32; payload unchanged',
    'sha256': hashlib.sha256(data).hexdigest()}, 'commercialCompressorExecuted': False})
print(json.dumps({'upstreamArchives': 5, 'derivedFileCopyArchive': True}))
