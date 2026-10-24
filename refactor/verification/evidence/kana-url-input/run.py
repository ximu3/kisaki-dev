"""Run controlled same-origin and CORS source scenarios in the pinned hidden browser."""
from pathlib import Path
import hashlib
import json
import os
import subprocess

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
CACHE=ROOT/'node_modules/.cache/kana-url-input'
CACHE.mkdir(parents=True,exist_ok=True)
runtime_receipt=HERE.parent/'libmpv-gpu/binary-input.json'
runtime=json.loads(runtime_receipt.read_text(encoding='utf-8'))['electron']['runtime']
environment=dict(os.environ)
environment.pop('ELECTRON_RUN_AS_NODE',None)
result=subprocess.run([str(Path(runtime)/'electron.exe'),str(HERE/'browser.cjs'),str(CACHE),str(CACHE/'browser-result.json')],
                      env=environment,capture_output=True,text=True,timeout=35,
                      creationflags=subprocess.CREATE_NO_WINDOW)
if result.returncode:
    raise RuntimeError('Stable URL input probe failed:\n'+result.stderr)
record=json.loads((CACHE/'browser-result.json').read_text(encoding='utf-8'))
record['runtimeReceiptSha256']=hashlib.sha256(runtime_receipt.read_bytes()).hexdigest()
record['sourceHashes']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in HERE.iterdir() if p.suffix in ['.py','.mjs','.cjs']}
(HERE/'browser-contract.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print(result.stdout,end='')
