"""Run the isolated browser comparison with the already pinned hidden Electron runtime."""
from pathlib import Path
import hashlib
import json
import os
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-xml-input'
runtime_receipt = HERE.parent / 'libmpv-gpu/binary-input.json'
runtime = json.loads(runtime_receipt.read_text(encoding='utf-8'))['electron']['runtime']
environment = dict(os.environ)
environment.pop('ELECTRON_RUN_AS_NODE', None)
result = subprocess.run([str(Path(runtime)/'electron.exe'),str(HERE/'browser.cjs'),str(CACHE),str(CACHE/'browser-result.json')],
                        env=environment,capture_output=True,text=True,timeout=50,
                        creationflags=subprocess.CREATE_NO_WINDOW)
if result.returncode:
    raise RuntimeError('XML browser comparison failed:\n'+result.stderr)
record = json.loads((CACHE/'browser-result.json').read_text(encoding='utf-8'))
record['runtimeReceiptSha256'] = hashlib.sha256(runtime_receipt.read_bytes()).hexdigest()
record['sourceHashes'] = {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in HERE.iterdir()
                        if p.suffix in ['.mjs','.cjs','.py','.c'] or p.name in ['source-input.json','build-contract.json']}
(HERE/'browser-contract.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(result.stdout,end='')
