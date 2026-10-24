"""Reuse the approved Expat bridge with its native XML ID-attribute observation."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-cfi'
CACHE.mkdir(parents=True, exist_ok=True)
input_file = HERE.parent / 'kana-xml-entry/build-contract.json'
previous = json.loads(input_file.read_text(encoding='utf-8'))
arguments = list(previous['arguments']['xml'])
arguments[arguments.index(str(HERE.parent / 'kana-xml-entry/xml.c'))] = str(HERE / 'source.c')
for index, argument in enumerate(arguments):
    if argument.startswith('-sEXPORTED_FUNCTIONS='):
        exports = json.loads(argument.split('=', 1)[1])
        arguments[index] = '-sEXPORTED_FUNCTIONS=' + json.dumps(exports + ['_kana_cfi_id_attribute'])
arguments[arguments.index('-o') + 1] = str(CACHE / 'xml.mjs')
toolchain = json.loads((HERE.parent / 'kana-rar/toolchain-input.json').read_text(encoding='utf-8'))
environment = dict(os.environ)
environment['EM_CONFIG'] = toolchain['config']
result = subprocess.run([sys.executable, str(Path(toolchain['compiler']) / 'emcc.py'), *arguments],
                        env=environment, capture_output=True, text=True,
                        creationflags=subprocess.CREATE_NO_WINDOW)
if result.returncode:
    raise RuntimeError('The CFI XML bridge failed to build:\n' + result.stderr)
h = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
report = {'checkedAt': datetime.now(timezone.utc).isoformat(),
          'baseInputReceiptSha256': h(input_file),
          'sources': {name: h(HERE / name) for name in ['build.py', 'source.c']},
          'includedSources': {str(file.relative_to(ROOT)): h(file) for file in [
              HERE.parent / 'kana-xml-entry/xml.c', HERE.parent / 'kana-xml-input/bridge.c']},
          'arguments': arguments,
          'outputs': {name: {'sha256': h(CACHE / name), 'bytes': (CACHE / name).stat().st_size}
                      for name in ['xml.mjs', 'xml.wasm']}}
(HERE / 'build-contract.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'wasmBytes': (CACHE / 'xml.wasm').stat().st_size}))
