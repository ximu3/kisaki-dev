"""Pin an independent fixture writer in an ignored cache; it is not a Kana dependency."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import shutil
import subprocess
import tarfile
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-kf8-fixed'
CACHE.mkdir(parents=True, exist_ok=True)
COMMIT = '7a6319c07ad8f3ae828a533b6bfcea367e49a0cf'
URL = f'https://codeload.github.com/behringer24/mobi/tar.gz/{COMMIT}'
archive_path = CACHE / 'writer.tar.gz'
if not archive_path.exists():
    archive_path.write_bytes(urllib.request.urlopen(URL, timeout=30).read())
archive_hash = hashlib.sha256(archive_path.read_bytes()).hexdigest()
receipt_file = HERE / 'source-input.json'
if receipt_file.exists():
    assert json.loads(receipt_file.read_text(encoding='utf-8'))['writer']['sha256'] == archive_hash
with tarfile.open(archive_path) as archive:
    for member in archive.getmembers():
        if not member.isfile():
            continue
        target = (CACHE / member.name).resolve()
        assert target.is_relative_to(CACHE.resolve())
        content = archive.extractfile(member).read()
        if target.exists():
            assert target.read_bytes() == content, member.name
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
source = CACHE / ('mobi-' + COMMIT)
generator = CACHE / 'generator'
generator.mkdir(exist_ok=True)
shutil.copyfile(HERE / 'fixture.go', generator / 'main.go')
(generator / 'go.mod').write_text(
    'module kana-fixed-fixture\n\ngo 1.21\n\nrequire github.com/behringer24/mobi v0.0.0\n'
    f'\nreplace github.com/behringer24/mobi => ../mobi-{COMMIT}\n', encoding='utf-8')
environment = dict(os.environ)
environment.update({'GOTOOLCHAIN': 'local', 'GOCACHE': str(CACHE / 'go-cache'),
                    'GOMODCACHE': str(CACHE / 'go-modules'), 'GOPATH': str(CACHE / 'go-path'),
                    'GOPROXY': 'https://proxy.golang.org', 'GOSUMDB': 'sum.golang.org', 'CGO_ENABLED': '0'})
def run(args):
    result = subprocess.run(args, cwd=generator, env=environment, capture_output=True, text=True,
                            creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        raise RuntimeError('The fixture writer failed:\n' + result.stderr)
    return result.stdout.strip()
run(['go', 'mod', 'tidy'])
binary = CACHE / 'fixture.exe'
run(['go', 'build', '-trimpath', '-o', str(binary), '.'])
print(run([str(binary), str(CACHE / 'books')]))
h = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
receipt = {
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'writer': {'repository': 'https://github.com/behringer24/mobi', 'commit': COMMIT,
               'archive': URL, 'sha256': archive_hash, 'license': 'MIT', 'modified': False},
    'goVersion': run(['go', 'version']), 'goExecutableSha256': h(Path(shutil.which('go'))),
    'sources': {file.name: h(file) for file in [HERE / 'fixture.go', HERE / 'prepare.py']},
    'moduleFile': (generator / 'go.mod').read_text(encoding='utf-8'),
    'moduleSums': (generator / 'go.sum').read_text(encoding='utf-8'),
    'writerInputs': {str(file.relative_to(source)): h(file) for file in source.rglob('*') if file.is_file()},
    'fixtureExecutableSha256': h(binary), 'expectedSha256': h(CACHE / 'books/expected.json'),
    'files': json.loads((CACHE / 'books/expected.json').read_text(encoding='utf-8'))['files'],
    'productionDependency': False, 'workspaceDependenciesChanged': False,
    'kindleDeviceCompatibilityChecked': False
}
receipt_file.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
