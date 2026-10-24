"""Prepare fixed HTML tokenizer dependencies in the ignored proof cache only."""
from pathlib import Path
import base64
import hashlib
import io
import json
import subprocess
import sys
import tarfile
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-formats'
sys.path.insert(0, str(HERE.parent / 'kana-rar'))
from record import write_receipt
records = []
for name, version in [('parse5', '8.0.1'), ('entities', '8.0.0')]:
    url = f'https://registry.npmjs.org/{name}/{version}'
    metadata = json.load(urllib.request.urlopen(url, timeout=30))
    data = urllib.request.urlopen(metadata['dist']['tarball'], timeout=30).read()
    algorithm, expected = metadata['dist']['integrity'].split('-', 1)
    assert base64.b64encode(hashlib.new(algorithm, data).digest()).decode() == expected
    destination = CACHE / 'node_modules' / name
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        for member in archive.getmembers():
            if not member.isfile(): continue
            relative = Path(member.name).relative_to('package')
            target = (destination / relative).resolve()
            assert target.is_relative_to(destination.resolve())
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.extractfile(member).read())
    records.append({'name': name, 'version': version, 'source': metadata['dist']['tarball'], 'license': metadata['license'],
                    'integrity': metadata['dist']['integrity'], 'sha256': hashlib.sha256(data).hexdigest()})
bundler = ROOT / 'node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild/bin/esbuild'
run = subprocess.run(['node', str(bundler), str(CACHE / 'node_modules/parse5/dist/index.js'), '--bundle', '--format=esm',
    '--platform=browser', '--outfile=' + str(CACHE / 'parse5.mjs')], capture_output=True, text=True,
    creationflags=subprocess.CREATE_NO_WINDOW)
if run.returncode: raise RuntimeError('HTML proof bundle failed:\n' + run.stderr)
write_receipt(HERE / 'html-input.json', {'packages': records, 'workspaceDependenciesChanged': False,
    'bundler': {'name': 'esbuild', 'version': '0.28.1'}, 'bundleSha256': hashlib.sha256((CACHE / 'parse5.mjs').read_bytes()).hexdigest()})
print(json.dumps({'packages': len(records)}))
