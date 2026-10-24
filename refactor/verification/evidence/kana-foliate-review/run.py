"""Capture a source-pinned comparison without adopting the upstream public interfaces."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-foliate-review'
sys.path.insert(0, str(HERE.parent / 'kana-rar'))
from record import write_receipt
manifest = json.loads((HERE / 'source-input.json').read_text(encoding='utf-8'))
for item in manifest['sources'] + manifest['references']:
    assert hashlib.sha256((CACHE / item['path']).read_bytes()).hexdigest() == item['sha256']
fixture_files = {}
source_fixtures = json.loads((HERE.parent / 'kana-source/fixture-input.json').read_text(encoding='utf-8'))
for item in source_fixtures['cases']:
    if item['format'] != 'fb2': continue
    path = ROOT / 'node_modules/.cache/kana-source/fixtures' / item['name']
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest == item['sha256']
    fixture_files['fb2/' + item['name']] = digest
format_inputs = json.loads((HERE.parent / 'kana-formats/source-input.json').read_text(encoding='utf-8'))
for item in format_inputs['inputs']:
    if item['name'] not in ['mobi/sample-cp1252.mobi', 'mobi/sample-ncx.mobi']: continue
    path = ROOT / 'node_modules/.cache/kana-formats' / item['name']
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    assert digest == item['sha256']
    fixture_files[item['name']] = digest
epub = json.loads((ROOT / 'node_modules/.cache/kana-formats/epub-documents.json').read_text(encoding='utf-8'))
epub_input = json.loads((HERE.parent / 'kana-formats/epub-fixture-input.json').read_text(encoding='utf-8'))
for name, value in epub.items():
    digest = hashlib.sha256(value.encode('utf-8')).hexdigest()
    assert digest == epub_input['documents'][name]
    fixture_files[name] = digest
rar_input = json.loads((HERE.parent / 'kana-rar-members/fixture-input.json').read_text(encoding='utf-8'))
rar_expected = next(item['sha256'] for item in rar_input['inputs'] if item['name'] == 'rar5-hlink.rar')
assert hashlib.sha256((ROOT / 'node_modules/.cache/kana-rar-members/fixtures/rar5-hlink.rar').read_bytes()).hexdigest() == rar_expected
fixture_files['rar5-hlink.rar'] = rar_expected
runtime = json.loads((HERE.parent / 'libmpv-gpu/binary-input.json').read_text(encoding='utf-8'))['electron']['runtime']
environment = dict(os.environ); environment.pop('ELECTRON_RUN_AS_NODE', None)
output = CACHE / 'review-result.json'
run = subprocess.run([str(Path(runtime) / 'electron.exe'), str(HERE / 'browser-electron.cjs'), str(ROOT), str(CACHE), str(output)],
                     env=environment, capture_output=True, text=True, timeout=60, creationflags=subprocess.CREATE_NO_WINDOW)
print(run.stdout, end='')
if run.returncode: raise RuntimeError('Foliate comparison failed:\n' + run.stderr)
record = json.loads(output.read_text(encoding='utf-8'))
record['recordedAt'] = datetime.now(timezone.utc).isoformat()
record['fixtureFiles'] = fixture_files
record['xmlCandidate'] = {
    'buildReceiptSha256': hashlib.sha256((HERE.parent / 'kana-formats/xml-build-contract.json').read_bytes()).hexdigest(),
    'adapterSha256': hashlib.sha256((HERE.parent / 'kana-formats/xml-parser.mjs').read_bytes()).hexdigest()
}
record['sourceInputSha256'] = hashlib.sha256((HERE / 'source-input.json').read_bytes()).hexdigest()
record['sources'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in HERE.iterdir() if p.suffix in ['.py', '.mjs', '.cjs', '.html']}
record['fixtureReceipts'] = {name: hashlib.sha256((HERE.parent / name).read_bytes()).hexdigest() for name in [
    'kana-source/fixture-input.json', 'kana-formats/source-input.json', 'kana-formats/epub-fixture-input.json', 'kana-rar-members/fixture-input.json']}
write_receipt(HERE / 'browser-contract.json', record)
