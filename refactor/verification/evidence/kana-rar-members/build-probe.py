"""Build a separate member-reference probe without changing the earlier RAR evidence."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BASE = HERE.parent / 'kana-rar'
sys.path.insert(0, str(BASE))
from record import write_receipt

CACHE = ROOT / 'node_modules/.cache/kana-rar-members'
BUILD = CACHE / 'build'
BUILD.mkdir(parents=True, exist_ok=True)
base = json.loads((BASE / 'build-contract.json').read_text())
for name, expected in base['inputs'].items():
    if hashlib.sha256((ROOT / name).read_bytes()).hexdigest() != expected:
        raise RuntimeError('The base decoder inputs changed')
toolchain = json.loads((BASE / 'toolchain-input.json').read_text())
compiler = Path(toolchain['compiler']) / 'em++.py'
environment = dict(os.environ)
environment['EM_CONFIG'] = toolchain['config']
own_object = BUILD / 'member-bridge.o'
run = subprocess.run([sys.executable, str(compiler), *base['compileFlags'], '-c', str(HERE / 'member-bridge.cpp'), '-o', str(own_object)],
                     env=environment, capture_output=True, text=True)
if run.returncode:
    raise RuntimeError('Member bridge compilation failed:\n' + run.stderr)
arguments = [arg for arg in base['linkArguments'] if not arg.endswith('dll.o') and not arg.endswith('bridge.o')]
arguments.insert(arguments.index('--no-entry'), str(own_object))
arguments[arguments.index('-o') + 1] = str(BUILD / 'unrar.mjs')
for index, arg in enumerate(arguments):
    if arg.startswith('-sEXPORTED_FUNCTIONS='):
        exports = json.loads(arg.split('=', 1)[1])
        exports += ['_kana_set_utf8_locale', '_kana_reference_in_data', '_kana_reference_target', '_kana_reference_directory', '_kana_windows_names', '_kana_process_reference']
        arguments[index] = '-sEXPORTED_FUNCTIONS=' + json.dumps(exports)
run = subprocess.run([sys.executable, str(compiler), *arguments], env=environment, capture_output=True, text=True)
if run.returncode:
    raise RuntimeError('Member bridge linking failed:\n' + run.stderr)
shutil.copyfile(ROOT / 'node_modules/.cache/kana-rar/build/license.txt', BUILD / 'license.txt')
write_receipt(HERE / 'build-contract.json', {'checkedAt': datetime.now(timezone.utc).isoformat(),
    'baseBuildSha256': hashlib.sha256((BASE / 'build-contract.json').read_bytes()).hexdigest(),
    'sourceSha256': hashlib.sha256((HERE / 'member-bridge.cpp').read_bytes()).hexdigest(),
    'upstreamFilesModified': False, 'dllImplementationIncludedOnce': True, 'linkArguments': arguments,
    'objects': {str(Path(arg).relative_to(ROOT)): hashlib.sha256(Path(arg).read_bytes()).hexdigest() for arg in arguments if arg.endswith('.o')},
    'outputs': {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in [BUILD / 'unrar.mjs', BUILD / 'unrar.wasm', BUILD / 'license.txt']}})
print(json.dumps({'memberBridgeBuilt': True, 'wasmBytes': (BUILD / 'unrar.wasm').stat().st_size}))
