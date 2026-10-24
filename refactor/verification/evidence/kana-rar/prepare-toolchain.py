"""Prepare an isolated, pinned Emscripten toolchain without activating a user SDK."""
from datetime import datetime, timezone
from pathlib import Path
import base64
import hashlib
import json
import shutil
import sys
import tarfile
import urllib.request
import zipfile
from record import write_receipt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-rar'
CACHE.mkdir(parents=True, exist_ok=True)
VERSION = '6.0.12'
BUILD = '6e9f6885cb17a3d6c8fd488a5cff730f50aba61d'
URL = f'https://storage.googleapis.com/webassembly/emscripten-releases-builds/win/{BUILD}/wasm-binaries.zip'
SDK_SHA256 = '51ac2e51a2c6eeba09fa04418496750662b5c1f022665814b0ee8f557c8328c9'
archive = CACHE / f'emscripten-{VERSION}.zip'
target = CACHE / f'emscripten-{VERSION}'
if not archive.exists():
    request = urllib.request.Request(URL, headers={'User-Agent': 'Kisaki-design-verification'})
    with urllib.request.urlopen(request, timeout=60) as response, archive.open('wb') as output:
        expected_size = int(response.headers['Content-Length'])
        md5 = hashlib.md5()
        received = 0
        boundary = 64 * 1024 * 1024
        for chunk in iter(lambda: response.read(1024 * 1024), b''):
            output.write(chunk)
            md5.update(chunk)
            received += len(chunk)
            if received >= boundary:
                print(json.dumps({'downloadedMiB': received // (1024 * 1024), 'totalMiB': expected_size // (1024 * 1024)}), flush=True)
                boundary += 64 * 1024 * 1024
        if received != expected_size:
            raise RuntimeError('Toolchain download is incomplete.')
        hashes = dict(item.strip().split('=', 1) for item in response.headers.get('x-goog-hash', '').split(',') if '=' in item)
        if 'md5' in hashes and base64.b64encode(md5.digest()).decode() != hashes['md5']:
            raise RuntimeError('Toolchain archive checksum mismatch.')
with archive.open('rb') as file:
    sha256 = hashlib.file_digest(file, 'sha256').hexdigest()
if sha256 != SDK_SHA256:
    raise RuntimeError('Toolchain archive differs from the recorded build.')
if not target.exists():
    target.mkdir()
    root = target.resolve()
    with zipfile.ZipFile(archive) as source:
        for member in source.infolist():
            if not (root / member.filename).resolve().is_relative_to(root):
                raise RuntimeError('Toolchain archive contains an out-of-scope path.')
        source.extractall(target)
candidates = list(target.rglob('emcc.py'))
if len(candidates) != 1:
    raise RuntimeError('Emscripten compiler entry is ambiguous.')
compiler = candidates[0].parent
sdk = compiler.parent
node = Path(shutil.which('node')).resolve()
config = CACHE / 'emscripten-config.py'
config.write_text('\n'.join([
    f'LLVM_ROOT = {str(sdk / "bin")!r}',
    f'BINARYEN_ROOT = {str(sdk)!r}',
    f'NODE_JS = [{str(node)!r}]',
    f'CACHE = {str(compiler / "cache")!r}',
]) + '\n', encoding='utf-8')
source_archive = CACHE.parent / 'kana-design/sources/unrarsrc-7.2.7.tar.gz'
source_archive.parent.mkdir(parents=True, exist_ok=True)
source_url = 'https://www.rarlab.com/rar/unrarsrc-7.2.7.tar.gz'
if not source_archive.exists():
    source_archive.write_bytes(urllib.request.urlopen(source_url, timeout=30).read())
source_sha256 = hashlib.sha256(source_archive.read_bytes()).hexdigest()
if source_sha256 != '01d903a7dcf413cb2925696d7796e48e38d471f79bfe7ef3ad2aebf6c12dbefd':
    raise RuntimeError('UnRAR source differs from the recorded archive.')
upstream = CACHE / 'upstream'
if not (upstream / 'unrar/version.hpp').exists():
    upstream.mkdir(exist_ok=True)
    with tarfile.open(source_archive) as source:
        source.extractall(upstream, filter='data')
receipt = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'version': VERSION, 'build': BUILD,
           'url': URL, 'archiveBytes': archive.stat().st_size, 'sha256': sha256,
           'compiler': str(compiler), 'config': str(config), 'python': sys.executable,
           'node': str(node), 'systemEnvironmentChanged': False}
receipt['sourceArchive'] = {'url': source_url, 'sha256': source_sha256, 'path': str(source_archive)}
write_receipt(HERE / 'toolchain-input.json', receipt)
print(json.dumps({'version': VERSION, 'compiler': str(compiler), 'archiveBytes': receipt['archiveBytes']}))
