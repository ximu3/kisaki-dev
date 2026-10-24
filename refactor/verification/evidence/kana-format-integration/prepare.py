"""Create one small owned archive for the remaining format integration checks."""
from pathlib import Path
import hashlib
import json
import struct
import zipfile
import zlib

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-format-integration'
CACHE.mkdir(parents=True, exist_ok=True)

def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))

png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR', struct.pack('>IIBBBBB', 2, 1, 8, 6, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(b'\x00\xff\x00\x00\xff\x00\x00\xff\xff'))
png += chunk(b'IEND', b'')
members = [
    ('pages/10.png', png),
    ('pages/2.dat', png),
    ('pages/1.png', b'This is an ordinary text file.'),
    ('notes.txt', b'Owned integration fixture.'),
]
with zipfile.ZipFile(CACHE / 'pages.cbz', 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for name, content in members:
        entry = zipfile.ZipInfo(name, (2026, 10, 20, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(entry, content)
for name, content in members:
    destination = CACHE / 'directory' / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(content)
report = {
    'archiveSha256': hashlib.sha256((CACHE / 'pages.cbz').read_bytes()).hexdigest(),
    'members': [{'name': name, 'sha256': hashlib.sha256(content).hexdigest(),
                 'bytes': len(content)} for name, content in members],
    'expectedPages': ['pages/2.dat', 'pages/10.png'],
    'ownedContent': True
}
(CACHE / 'expected.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
