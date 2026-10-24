"""Relink the verified objects with a 32 MiB heap ceiling to exercise native exhaustion."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys
from record import write_receipt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-rar'
LIMITED = CACHE / 'limited'
LIMITED.mkdir(exist_ok=True)
build = json.loads((HERE / 'build-contract.json').read_text(encoding='utf-8'))
for name, expected in build['inputs'].items():
    if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != expected:
        raise RuntimeError('Build inputs changed; rebuild the main probe first')
toolchain = json.loads((HERE / 'toolchain-input.json').read_text(encoding='utf-8'))
arguments = build['linkArguments'][:]
arguments[arguments.index('-o') + 1] = str(LIMITED / 'unrar.mjs')
arguments[arguments.index('-sMAXIMUM_MEMORY=268435456')] = '-sMAXIMUM_MEMORY=33554432'
environment = dict(os.environ)
environment['EM_CONFIG'] = toolchain['config']
run = subprocess.run([sys.executable, str(Path(toolchain['compiler']) / 'em++.py'), *arguments],
                     env=environment, capture_output=True, text=True)
if run.returncode:
    raise RuntimeError('Limited heap link failed:\n' + run.stderr)
receipt = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'maximumMemoryBytes': 33554432,
           'baseBuildSha256': hashlib.sha256((HERE / 'build-contract.json').read_bytes()).hexdigest(),
           'linkArguments': arguments, 'outputs': {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                                                 for p in [LIMITED / 'unrar.mjs', LIMITED / 'unrar.wasm']}}
write_receipt(HERE / 'limited-build-contract.json', receipt)
print(json.dumps({'limitedBuild': True, 'maximumMemoryBytes': 33554432}))
