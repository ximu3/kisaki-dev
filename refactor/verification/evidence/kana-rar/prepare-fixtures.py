"""Prepare fixed upstream RAR samples, provenance, and independent content expectations."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import binascii
import hashlib
import json
import struct
import urllib.request
from record import write_receipt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-rar'
FIXTURES = CACHE / 'fixtures'
FIXTURES.mkdir(exist_ok=True)
BASE = 'https://raw.githubusercontent.com/libarchive/libarchive/v3.8.10/'
NAMES = ['test_read_format_rar.rar', 'test_read_format_rar_unicode.rar', 'test_read_format_rar3_lowdist_reset.rar',
         'test_read_format_rar_multi_lzss_blocks.rar',
         'test_read_format_rar4_solid_encrypted.rar', 'test_read_format_rar4_solid_encrypted_filenames.rar',
         'test_read_format_rar5_multiple_files_solid.rar', 'test_read_format_rar5_solid.rar',
         'test_read_format_rar5_unicode.rar', 'test_read_format_rar5_solid_encrypted.rar',
         'test_read_format_rar5_solid_encrypted_filenames.rar', 'test_read_format_rar5_arm.rar',
         'test_read_format_rar5_blake2.rar', 'test_read_format_rar5_compressed.rar',
         'test_read_format_rar5_hardlink.rar', 'test_read_format_rar5_symlink.rar']
NAMES += [f'test_read_format_rar5_multiarchive_solid.part{i:02}.rar' for i in range(1, 5)]


def fetch(name):
    url = BASE + 'libarchive/test/' + name + '.uu'
    encoded = urllib.request.urlopen(url, timeout=30).read()
    lines = encoded.splitlines()
    start = next(i for i, line in enumerate(lines) if line.startswith(b'begin ')) + 1
    data = b''.join(binascii.a2b_uu(line) for line in lines[start:] if line not in [b'end', b''])
    (FIXTURES / name).write_bytes(data)
    return {'file': name, 'source': url, 'bytes': len(data),
            'encodedSha256': hashlib.sha256(encoded).hexdigest(), 'sha256': hashlib.sha256(data).hexdigest()}


with ThreadPoolExecutor(max_workers=4) as executor:
    samples = list(executor.map(fetch, NAMES))
sources = []
for name in ['COPYING', 'libarchive/test/test_read_format_rar.c',
             'libarchive/test/test_read_format_rar5.c', 'libarchive/test/test_read_format_rar_encryption.c']:
    data = urllib.request.urlopen(BASE + name, timeout=30).read()
    path = CACHE / ('libarchive-COPYING' if name == 'COPYING' else 'fixtures/' + name.split('/')[-1])
    path.write_bytes(data)
    sources.append({'source': BASE + name, 'sha256': hashlib.sha256(data).hexdigest()})
expected = {}
for magic in range(1, 5):
    content = b''.join(struct.pack('<I', max(0, k * k - 3 * k + 1 + magic)) for k in range(1, 1025))
    expected[f'test{magic}.bin'] = {'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest(),
                                    'crc32': binascii.crc32(content)}
result = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'upstreamTag': 'v3.8.10',
          'fixtures': samples, 'licenseAndExpectations': sources, 'solidExpectedContent': expected,
          'encryptedExpectedContent': {f'{name}.txt': {'bytes': 18, 'crc32': binascii.crc32(f'This is from {name}.txt'.encode())}
                                       for name in 'abcd'},
          'multivolumeExpectedCrc': dict(zip(['cebula.txt', 'test.bin', *[f'test{i}.bin' for i in range(1, 7)], 'elf-Linux-ARMv7-ls'],
                                           [0x7E5EC49E, 0x7CCA70CD, 0x7E13B2C6, 0xF166AFCB, 0x9FB123D9, 0x10C43ED4, 0xB9D155F2, 0x36A448FF, 0x886F91EB])),
          'fixturePasswordIsPublicTestData': True, 'commercialRarCompressorExecuted': False}
write_receipt(HERE / 'fixture-input.json', result)
print(json.dumps({'fixtures': len(samples), 'bytes': sum(s['bytes'] for s in samples)}))
