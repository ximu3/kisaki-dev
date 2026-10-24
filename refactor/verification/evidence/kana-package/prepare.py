"""Stage fixed ZIP assets through an archive into an independent consumer directory."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import tarfile
import tempfile
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache'
source = CACHE / 'kana-design/sources/zip.tgz'
previous = json.loads((HERE / '../kana/reading-source-contract.json').read_text(encoding='utf-8'))
dependency = next(item for item in previous['packages'] if 'zip.js-2.24.0.tgz' in item['url'])
digest = lambda data: hashlib.sha256(data).hexdigest()
assert digest(source.read_bytes()) == dependency['sha256']
work = Path(tempfile.mkdtemp(prefix='kana-package-', dir=CACHE))
stage = work / 'stage'
stage.mkdir()
with tarfile.open(source) as archive:
    for item in archive.getmembers():
        relative = item.name.removeprefix('package/')
        if item.isfile() and ((relative.startswith('lib/') and relative.endswith('.js')) or
                              relative in ['dist/zip-module.wasm', 'LICENSE', 'package.json']):
            target = stage / 'vendor/zip' / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.extractfile(item).read())
(stage / 'archive-worker.mjs').write_bytes((HERE / 'archive-worker.mjs').read_bytes())
for label in ['a', 'b']:
    text = f'Archive {label}: 甲乙\r\n'.encode('utf-8')
    output = BytesIO()
    with zipfile.ZipFile(output, 'w') as archive:
        entry = zipfile.ZipInfo('chapter.txt', date_time=(2026, 10, 21, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(entry, text)
    (stage / f'{label}.zip').write_bytes(output.getvalue())
files = {file.relative_to(stage).as_posix(): digest(file.read_bytes())
         for file in sorted(stage.rglob('*')) if file.is_file()}
(stage / 'manifest.json').write_text(json.dumps({'designFixtureOnly': True, 'files': files}, indent=2) + '\n', encoding='utf-8')
package = work / 'assets.tgz'
with tarfile.open(package, 'w:gz') as archive:
    archive.add(stage, arcname='assets')
consumer = work / 'consumer'
with tarfile.open(package) as archive:
    archive.extractall(consumer, filter='data')
for name, expected in files.items():
    assert digest((consumer / 'assets' / name).read_bytes()) == expected
receipt = {'consumer': str(consumer / 'assets'), 'files': files,
           'dependency': dependency, 'packageSha256': digest(package.read_bytes()),
           'prepareSha256': digest(Path(__file__).read_bytes()),
           'formalKanaPackage': False}
(HERE / 'source-input.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'stagedFiles': len(files), 'publicZipEntry': '@zip.js/zip.js/external'}))
