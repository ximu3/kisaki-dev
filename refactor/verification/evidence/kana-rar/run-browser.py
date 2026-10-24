"""Execute the Wasm decoder in a hidden, sandboxed Chromium worker and record evidence."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import subprocess
from record import write_receipt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-rar'
runtime = json.loads((HERE.parent / 'libmpv-gpu/binary-input.json').read_text(encoding='utf-8'))['electron']['runtime']
environment = dict(os.environ)
environment.pop('ELECTRON_RUN_AS_NODE', None)
output = CACHE / 'browser-result.json'
run = subprocess.run([str(Path(runtime) / 'electron.exe'), str(HERE / 'browser-electron.cjs'), str(CACHE), str(output)],
                     cwd=ROOT, env=environment, capture_output=True, text=True, timeout=150,
                     creationflags=subprocess.CREATE_NO_WINDOW)
print(run.stdout, end='')
if run.returncode:
    raise RuntimeError('Browser decoder verification failed:\n' + run.stderr)
result = json.loads(output.read_text(encoding='utf-8'))
result['recordedAt'] = datetime.now(timezone.utc).isoformat()
result['sources'] = {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest() for name in
                     ['bridge.cpp', 'async-input.js', 'record.py', 'build-probe.py', 'build-limited.py', 'prepare-toolchain.py', 'prepare-fixtures.py', 'fixture-input.json',
                      'decode-worker.mjs', 'browser-probe.html', 'browser-probe.mjs', 'browser-electron.cjs', 'run-browser.py']}
result['buildReceiptSha256'] = hashlib.sha256((HERE / 'build-contract.json').read_bytes()).hexdigest()
result['limitedBuildReceiptSha256'] = hashlib.sha256((HERE / 'limited-build-contract.json').read_bytes()).hexdigest()
result['toolchainReceiptSha256'] = hashlib.sha256((HERE / 'toolchain-input.json').read_bytes()).hexdigest()
write_receipt(HERE / 'browser-contract.json', result)
print(json.dumps({'cases': len(result['cases']), 'allAssertionsPassed': True}))
