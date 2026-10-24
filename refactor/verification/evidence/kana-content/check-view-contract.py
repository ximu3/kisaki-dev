"""Typecheck the proposed view-read scope independently of runtime mechanisms."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-content'
run = Path(tempfile.mkdtemp(prefix='types-', dir=CACHE))
consumer = (HERE / 'view-consumer.ts').read_text(encoding='utf-8')
# Absolute imports keep the copied consumer independent of its temporary directory.
consumer = consumer.replace("'./view-contract.js'", repr((HERE / 'view-contract.js').as_posix()))
consumer = consumer.replace("'../kana-api/contracts.js'", repr((HERE.parent / 'kana-api/contracts.js').as_posix()))
(run / 'consumer.ts').write_text(consumer, encoding='utf-8')
config = {'compilerOptions': {'strict': True, 'noEmit': True, 'skipLibCheck': False,
    'target': 'ES2023', 'module': 'ESNext', 'moduleResolution': 'Bundler', 'types': [],
    'lib': ['ES2023', 'DOM'], 'exactOptionalPropertyTypes': True}, 'files': ['consumer.ts']}
(run / 'tsconfig.json').write_text(json.dumps(config), encoding='utf-8')
command = ['node', str(ROOT / 'node_modules/typescript/bin/tsc'), '-p', str(run / 'tsconfig.json'), '--pretty', 'false']
positive = subprocess.run(command, capture_output=True, text=True)
if positive.returncode:
    raise RuntimeError(positive.stdout + positive.stderr)
(run / 'consumer.ts').write_text(re.sub(r'^\s*// @ts-expect-error.*$', '', consumer, flags=re.MULTILINE), encoding='utf-8')
negative = subprocess.run(command, capture_output=True, text=True)
count = len(re.findall(r'error TS\d+:', negative.stdout))
assert negative.returncode and count == 5, negative.stdout
result = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'positivePassed': True,
          'expectedRejections': 5, 'diagnostics': count, 'readerExecuted': False,
          'formalPackageExportsTested': False,
          'sources': {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest()
                      for name in ['view-contract.d.ts', 'view-consumer.ts', 'check-view-contract.py']}}
(HERE / 'view-declaration-contract.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'positivePassed': True, 'rejected': count}))
