"""Record the complete Node proof results, including independent source hashes and limits."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-formats'
sys.path.insert(0, str(HERE.parent / 'kana-rar'))
from record import write_receipt
jobs = [
    ('mobi', 'mobi-probe.mjs', [str(CACHE)], 'mobi-result.json'),
    ('markup', 'markup-node.mjs', [str(CACHE)], 'markup-result.json'),
    ('xml', 'xml-node.mjs', [str(CACHE), str(ROOT / 'node_modules/.cache/kana-source')], 'xml-node-result.json'),
    ('names', 'names-node.mjs', [str(CACHE), str(ROOT / 'node_modules/.cache/kana-rar')], 'names-result.json'),
    ('cfi', 'cfi-node.mjs', [str(CACHE)], 'cfi-result.json')
]
results = {}
for name, script, arguments, filename in jobs:
    run = subprocess.run(['node', str(HERE / script), *arguments, str(CACHE / filename)], cwd=ROOT,
                         capture_output=True, text=True, timeout=60, creationflags=subprocess.CREATE_NO_WINDOW)
    if run.returncode: raise RuntimeError('Node format proof failed: ' + name + '\n' + run.stderr)
    results[name] = json.loads((CACHE / filename).read_text(encoding='utf-8'))
    print(json.dumps({'mode': name, 'passed': True}))
write_receipt(HERE / 'node-contract.json', {'recordedAt': datetime.now(timezone.utc).isoformat(),
    'node': subprocess.check_output(['node', '--version'], text=True).strip(), 'results': results,
    'sources': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in HERE.iterdir() if p.suffix in ['.mjs', '.py']},
    'inputs': {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest() for name in [
        'source-input.json', 'mobi-adapter-input.json', 'html-input.json', 'encoding-input.json',
        'xml-build-contract.json', 'names-build-contract.json', 'names-fixture-input.json', 'epub-fixture-input.json']},
    'candidateOnly': True})
