"""Pack declaration specimens and typecheck consumers outside the workspace package graph."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-api'
CACHE.mkdir(parents=True, exist_ok=True)
RUN = Path(tempfile.mkdtemp(prefix='contracts-', dir=CACHE))
PACKAGE = RUN / 'package'
PACKAGE.mkdir()
for name in ['contracts.d.ts', 'browser.d.ts']:
    shutil.copyfile(HERE / name, PACKAGE / name)
manifest = {
    'name': '@ximu3/kana', 'version': '0.0.0-design', 'private': True, 'type': 'module',
    'exports': {'.': {'types': './browser.d.ts'}, './contracts': {'types': './contracts.d.ts'}},
}
(PACKAGE / 'package.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
archive_path = RUN / 'kana-declarations.tgz'
with tarfile.open(archive_path, 'w:gz') as archive:
    for file in PACKAGE.iterdir():
        archive.add(file, arcname='package/' + file.name)
compiler = ROOT / 'node_modules/typescript/bin/tsc'
compiler_version = subprocess.check_output(['node', str(compiler), '--version'], text=True).strip()
checks = []
for kind, resolution, module, libraries in [
    ('pure', 'NodeNext', 'NodeNext', ['ES2023']),
    ('browser', 'Bundler', 'ESNext', ['ES2023', 'DOM', 'DOM.Iterable']),
    ('view', 'Bundler', 'ESNext', ['ES2023', 'DOM', 'DOM.Iterable']),
]:
    consumer = RUN / kind
    installed = consumer / 'node_modules/@ximu3/kana'
    installed.mkdir(parents=True)
    with tarfile.open(archive_path) as archive:
        archive.extractall(consumer / 'unpacked', filter='data')
    for file in (consumer / 'unpacked/package').iterdir():
        shutil.copyfile(file, installed / file.name)
    (consumer / 'package.json').write_text('{"type":"module"}', encoding='utf-8')
    source = (HERE / f'consumer-{kind}.ts').read_text(encoding='utf-8')
    (consumer / 'consumer.ts').write_text(source, encoding='utf-8')
    config = {'compilerOptions': {'strict': True, 'noEmit': True, 'skipLibCheck': False,
                                  'exactOptionalPropertyTypes': True, 'noUncheckedIndexedAccess': True,
                                  'target': 'ES2023', 'module': module, 'moduleResolution': resolution,
                                  'lib': libraries, 'types': []}, 'files': ['consumer.ts']}
    (consumer / 'tsconfig.json').write_text(json.dumps(config), encoding='utf-8')
    command = ['node', str(compiler), '-p', str(consumer / 'tsconfig.json'), '--pretty', 'false']
    positive = subprocess.run(command, capture_output=True, text=True, cwd=consumer)
    if positive.returncode:
        raise RuntimeError(f'{kind} consumer failed:\n{positive.stdout}\n{positive.stderr}')
    negatives = source.count('@ts-expect-error')
    (consumer / 'consumer.ts').write_text(re.sub(r'^\s*// @ts-expect-error.*$', '', source, flags=re.MULTILINE), encoding='utf-8')
    rejected = subprocess.run(command, capture_output=True, text=True, cwd=consumer)
    diagnostics = re.findall(r'error TS\d+:', rejected.stdout)
    if not rejected.returncode or len(diagnostics) < negatives:
        raise RuntimeError(f'{kind} negative consumer was not rejected as expected:\n{rejected.stdout}')
    checks.append({'consumer': kind, 'resolution': resolution, 'libraries': libraries,
                   'positivePassed': True, 'expectedRejections': negatives, 'diagnostics': len(diagnostics)})
receipt = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'compiler': compiler_version,
           'declarationPackageOnly': True, 'readerImplementationExecuted': False,
           'runtimeAssetLoadingExecuted': False, 'sourceOwnershipRuntimeExecuted': False,
           'checks': checks, 'tarballSha256': hashlib.sha256(archive_path.read_bytes()).hexdigest(),
           'sources': {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest() for name in
                       ['contracts.d.ts', 'browser.d.ts', 'consumer-pure.ts', 'consumer-browser.ts', 'consumer-view.ts', 'check-contracts.py']}}
(HERE / 'declaration-contract.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'compiler': compiler_version, 'consumers': len(checks),
                  'expectedRejections': sum(c['expectedRejections'] for c in checks)}))
