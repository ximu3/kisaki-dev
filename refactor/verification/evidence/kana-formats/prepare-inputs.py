"""Pin the parser candidate, format references, and upstream MOBI sample inputs."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import sys
import tarfile
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-formats'
CACHE.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(HERE.parent / 'kana-rar'))
from record import write_receipt

EXPAT = 'e127b43ac1f514e0b320508893aa338ecd5e72be'
LIBMOBI = '906274205c11944b628da1c553b255acb1af7c55'
inputs = []
def fetch(name, url):
    target = CACHE / name
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'Kana-design-verification'})
        target.write_bytes(urllib.request.urlopen(request, timeout=40).read())
    data = target.read_bytes()
    inputs.append({'name': name, 'source': url, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    return target

archive = fetch('expat.tar.gz', f'https://codeload.github.com/libexpat/libexpat/tar.gz/{EXPAT}')
destination = CACHE / 'expat-source'
destination.mkdir(exist_ok=True)
with tarfile.open(archive) as source:
    source.extractall(destination, filter='data')

for name in ['sample-cp1252.mobi', 'sample-ncx.mobi', 'sample-unicode-huffdic.mobi',
             'sample-unicode-uncompressed.mobi', 'sample-multimedia.mobi', 'sample-obfuscated-fonts.mobi']:
    fetch('mobi/' + name, f'https://raw.githubusercontent.com/bfabiszewski/libmobi/{LIBMOBI}/tests/samples/{name}')
for name in ['tests/test.sh.in', 'COPYING', 'README.md']:
    fetch('libmobi/' + name, f'https://raw.githubusercontent.com/bfabiszewski/libmobi/{LIBMOBI}/{name}')
tree = json.load(urllib.request.urlopen(f'https://api.github.com/repos/bfabiszewski/libmobi/git/trees/{LIBMOBI}?recursive=1', timeout=30))
for item in tree['tree']:
    if item['path'].startswith('tests/md5/'):
        fetch('libmobi/' + item['path'], f'https://raw.githubusercontent.com/bfabiszewski/libmobi/{LIBMOBI}/' + item['path'])
for name, url in [
    ('expat-api.html', 'https://libexpat.github.io/doc/api/latest/'),
    ('epub-cfi.html', 'https://w3c.github.io/epub-specs/epub33/epubcfi/'),
    ('epub-reading-systems.html', 'https://www.w3.org/TR/epub-rs-33/'),
    ('epub.html', 'https://www.w3.org/TR/epub-33/'),
    ('rar5.html', 'https://www.rarlab.com/technote.htm')]:
    fetch('sources/' + name, url)
write_receipt(HERE / 'source-input.json', {'recordedAt': datetime.now(timezone.utc).isoformat(),
    'expat': {'version': '2.9.0', 'commit': EXPAT, 'candidateOnly': True},
    'libmobi': {'commit': LIBMOBI, 'usage': 'fixtures and independent expected hashes; library not adopted'},
    'inputs': inputs})
print(json.dumps({'inputs': len(inputs), 'expatSource': str(destination / ('libexpat-' + EXPAT) / 'expat')}))
