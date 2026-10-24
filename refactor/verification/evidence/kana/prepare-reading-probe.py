"""Fetch pinned primary inputs for the Kana reading-route proposal."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import base64
import hashlib
import io
import json
import tarfile
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-design'
SOURCES = CACHE / 'sources'
SOURCES.mkdir(parents=True, exist_ok=True)
INPUTS = {
    'mobi.js': 'https://raw.githubusercontent.com/johnfactotum/foliate-js/78914aef4466eb960965702401634c2cb348e9b1/mobi.js',
    'foliate-LICENSE': 'https://raw.githubusercontent.com/johnfactotum/foliate-js/78914aef4466eb960965702401634c2cb348e9b1/LICENSE',
    'archive-reader.js': 'https://raw.githubusercontent.com/nika-begiashvili/libarchivejs/0989c1a6db20d030d793b1763e20d880068091bd/src/webworker/archive-reader.js',
    'archive-main.c': 'https://raw.githubusercontent.com/nika-begiashvili/libarchivejs/0989c1a6db20d030d793b1763e20d880068091bd/lib/wrapper/main.c',
    'archive-rar.c': 'https://raw.githubusercontent.com/libarchive/libarchive/v3.8.10/libarchive/archive_read_support_format_rar.c',
    'archive-rar5.c': 'https://raw.githubusercontent.com/libarchive/libarchive/v3.8.10/libarchive/archive_read_support_format_rar5.c',
    'unrarsrc-7.2.7.tar.gz': 'https://www.rarlab.com/rar/unrarsrc-7.2.7.tar.gz',
    'asyncify.html': 'https://emscripten.org/docs/porting/asyncify.html',
    'pdf-npm.json': 'https://registry.npmjs.org/pdfjs-dist/6.4.299',
    'zip-npm.json': 'https://registry.npmjs.org/@zip.js/zip.js/2.24.0',
    'parse5-npm.json': 'https://registry.npmjs.org/parse5/8.0.1',
    'css-tree-npm.json': 'https://registry.npmjs.org/css-tree/3.2.1',
    'parse5-options.html': 'https://parse5.js.org/interfaces/parse5.ParserOptions.html',
    'css-tree-readme.md': 'https://raw.githubusercontent.com/csstree/csstree/v3.2.1/README.md',
}


def fetch(item):
    name, url = item
    request = urllib.request.Request(url, headers={'User-Agent': 'Kisaki-design-verification'})
    with urllib.request.urlopen(request, timeout=35) as response:
        data = response.read()
        result = {'name': name, 'url': url, 'finalUrl': response.url, 'status': response.status,
                  'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    (SOURCES / name).write_bytes(data)
    return result


with ThreadPoolExecutor(max_workers=4) as executor:
    receipts = list(executor.map(fetch, INPUTS.items()))

packages = []
for name in ['pdf', 'zip']:
    metadata = json.loads((SOURCES / f'{name}-npm.json').read_text(encoding='utf-8'))
    package = fetch((f'{name}.tgz', metadata['dist']['tarball']))
    data = (SOURCES / f'{name}.tgz').read_bytes()
    integrity = 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode()
    if integrity != metadata['dist']['integrity']:
        raise ValueError(f'Package integrity mismatch: {name}.')
    (CACHE / f'{name}.tgz').write_bytes(data)
    target = CACHE / name
    target.mkdir(exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        archive.extractall(target, filter='data')
    package.update({'version': metadata['version'], 'license': metadata['license'],
                    'registryIntegrityVerified': True, 'integrity': integrity})
    packages.append(package)

with tarfile.open(SOURCES / 'unrarsrc-7.2.7.tar.gz') as archive:
    for name in ['license.txt', 'version.hpp', 'file.cpp', 'dll.cpp', 'unpack.cpp']:
        (SOURCES / ('unrar-stable-' + name)).write_bytes(archive.extractfile('unrar/' + name).read())
version = (SOURCES / 'unrar-stable-version.hpp').read_text(encoding='utf-8')
assert 'RARVER_MINOR    23' in version and 'RARVER_BETA      0' in version
assert 'RAR solid archive support unavailable' in (SOURCES / 'archive-rar.c').read_text(encoding='utf-8')
assert 'await file.arrayBuffer()' in (SOURCES / 'archive-reader.js').read_text(encoding='utf-8')
assert 'archive_read_open_memory' in (SOURCES / 'archive-main.c').read_text(encoding='utf-8')
result = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'designStatus': 'proposal',
          'sources': receipts, 'packages': packages, 'unrarSourceVersion': '7.23',
          'unrarArchiveName': 'unrarsrc-7.2.7.tar.gz', 'wasmBuildExecuted': False,
          'rarDecoderExecuted': False, 'mobiDecoderExecuted': False,
          'kanaProjectCreated': False, 'completeDependencyTupleLocked': False}
(HERE / 'reading-source-contract.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'sources': len(receipts), 'packages': len(packages), 'unrarSourceVersion': result['unrarSourceVersion']}))
