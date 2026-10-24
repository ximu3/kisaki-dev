"""Pin deterministic OEM tables and a legacy-name fixture for the explicit-encoding proposal."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import binascii
import hashlib
import json
import re
import struct
import sys
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-formats'
DEST = CACHE / 'encodings'
DEST.mkdir(exist_ok=True)
sys.path.insert(0, str(HERE.parent / 'kana-rar'))
from record import write_receipt
def fetch(page):
    url = f'https://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/PC/CP{page}.TXT'
    data = urllib.request.urlopen(url, timeout=30).read()
    (DEST / f'CP{page}.TXT').write_bytes(data)
    mapping = [-1] * 256
    for line in data.decode('ascii').splitlines():
        match = re.match(r'0x([0-9a-f]+)\s+0x([0-9a-f]+)', line, re.I)
        if match: mapping[int(match[1], 16)] = int(match[2], 16)
    assert mapping[0] == 0 and mapping[47] == 47 and mapping[92] == 92
    return {'name': 'ibm' + str(page), 'source': url, 'sha256': hashlib.sha256(data).hexdigest(), 'map': mapping}
with ThreadPoolExecutor(max_workers=4) as executor:
    records = list(executor.map(fetch, [437, 850, 852, 855, 857, 860, 861, 862, 863, 864, 865, 869]))
maps = {item['name']: item['map'] for item in records}
url = 'https://encoding.spec.whatwg.org/index-windows-1252.txt'
data = urllib.request.urlopen(url, timeout=30).read()
(DEST / 'index-windows-1252.txt').write_bytes(data)
mapping = list(range(128)) + [-1] * 128
for line in data.decode('utf-8').splitlines():
    match = re.match(r'\s*(\d+)\s+0x([0-9a-f]+)', line, re.I)
    if match: mapping[int(match[1]) + 128] = int(match[2], 16)
assert mapping[0x80] == 0x20ac and mapping[0x82] == 0x201a
maps['windows-1252'] = mapping
records.append({'name': 'windows-1252', 'source': url, 'sha256': hashlib.sha256(data).hexdigest(), 'map': mapping})
license_url = 'https://www.unicode.org/license.txt'
license_bytes = urllib.request.urlopen(license_url, timeout=30).read()
(DEST / 'UNICODE-LICENSE.txt').write_bytes(license_bytes)
(CACHE / 'oem-maps.json').write_text(json.dumps(maps), encoding='utf-8')

base = ROOT / 'node_modules/.cache/kana-rar-members/fixtures/rar3-symlink-unix.rar'
data = bytearray(base.read_bytes())
position = 7
while position < len(data):
    kind = data[position + 2]
    flags, size = struct.unpack_from('<HH', data, position + 3)
    if kind == 0x74:
        name_size = struct.unpack_from('<H', data, position + 26)[0]
        if name_size == 8 and data[position + 32:position + 40] == b'data.txt':
            assert not flags & 0x200 and not flags & 0x100
            data[position + 32:position + 40] = b'caf\x82.txt'
            struct.pack_into('<H', data, position, binascii.crc32(data[position + 2:position + size]) & 65535)
            break
    payload = struct.unpack_from('<I', data, position + 7)[0] if flags & 0x8000 else 0
    position += size + payload
else: raise RuntimeError('The fixed RAR3 source has no matching regular header')
file = CACHE / 'names/legacy-cp437.rar'
file.write_bytes(data)
original = base.read_bytes()
header = bytearray(original[position:position + size])
broken = b'b\x00\x00\x80A'
header = header[:32] + broken + header[32 + name_size:]
struct.pack_into('<H', header, 3, flags | 0x200)
struct.pack_into('<H', header, 5, len(header))
struct.pack_into('<H', header, 26, len(broken))
struct.pack_into('<H', header, 0, binascii.crc32(header[2:]) & 65535)
malformed = original[:position] + header + original[position + size:]
(CACHE / 'names/invalid-legacy-unicode.rar').write_bytes(malformed)
write_receipt(HERE / 'encoding-input.json', {'tables': [{k: v for k, v in item.items() if k != 'map'} for item in records],
    'license': {'source': license_url, 'sha256': hashlib.sha256(license_bytes).hexdigest()},
    'mapsSha256': hashlib.sha256((CACHE / 'oem-maps.json').read_bytes()).hexdigest(),
    'fixture': {'name': file.name, 'base': base.name, 'baseSha256': hashlib.sha256(base.read_bytes()).hexdigest(),
                'sha256': hashlib.sha256(data).hexdigest(), 'mutation': 'Rename first RAR3 member to CP437 bytes for café.txt; update only header CRC'},
    'invalidUnicodeFixture': {'name': 'invalid-legacy-unicode.rar', 'sha256': hashlib.sha256(malformed).hexdigest(),
                              'mutation': 'Supply an incomplete mode-2 Unicode name with a valid header checksum; preserve the original payload'},
    'publicInputChangeProposed': True, 'acceptedContractChanged': False})
print(json.dumps({'tables': len(records), 'legacyFixture': file.name}))
