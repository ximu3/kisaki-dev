"""Run the source address proof and bind its results to exact fixtures and scripts."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-source'
sys.path.insert(0, str(HERE.parent / 'kana-rar'))
from record import write_receipt

runtime = json.loads((HERE.parent / 'libmpv-gpu/binary-input.json').read_text())['electron']['runtime']
environment = dict(os.environ)
environment.pop('ELECTRON_RUN_AS_NODE', None)
output = CACHE / 'browser-result.json'
run = subprocess.run([str(Path(runtime) / 'electron.exe'), str(HERE / 'browser-electron.cjs'), str(CACHE), str(output)],
                     env=environment, cwd=ROOT, capture_output=True, text=True, timeout=90,
                     creationflags=subprocess.CREATE_NO_WINDOW)
print(run.stdout, end='')
if run.returncode: raise RuntimeError('Source browser proof failed:\n' + run.stderr)
receipt = json.loads(output.read_text(encoding='utf-8'))
receipt['recordedAt'] = datetime.now(timezone.utc).isoformat()
receipt['sources'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in HERE.iterdir()
                      if p.suffix in ['.mjs', '.cjs', '.py', '.html']}
receipt['fixtureReceiptSha256'] = hashlib.sha256((HERE / 'fixture-input.json').read_bytes()).hexdigest()
write_receipt(HERE / 'browser-contract.json', receipt)
