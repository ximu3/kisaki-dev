"""Compile the fixed XML parser candidate using the already pinned Emscripten toolchain."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-formats'
BUILD = CACHE / 'xml-build'
BUILD.mkdir(exist_ok=True)
SOURCE = CACHE / 'expat-source/libexpat-e127b43ac1f514e0b320508893aa338ecd5e72be/expat'
sys.path.insert(0, str(HERE.parent / 'kana-rar'))
from record import write_receipt

toolchain = json.loads((HERE.parent / 'kana-rar/toolchain-input.json').read_text(encoding='utf-8'))
upstream_inputs = {}
prefix = 'libexpat-e127b43ac1f514e0b320508893aa338ecd5e72be/expat/'
with tarfile.open(CACHE / 'expat.tar.gz') as archive:
    for member in archive.getmembers():
        if member.isfile() and member.name.startswith(prefix + 'lib/') and member.name.endswith(('.c', '.h')):
            relative = member.name[len(prefix):]
            actual = (SOURCE / relative).read_bytes()
            assert actual == archive.extractfile(member).read(), relative
            upstream_inputs[relative] = hashlib.sha256(actual).hexdigest()
environment = dict(os.environ)
environment['EM_CONFIG'] = toolchain['config']
inputs = [SOURCE / 'lib' / name for name in ['xmlparse.c', 'xmltok.c', 'xmlrole.c', 'xcs.c', 'random_getentropy.c']] + [HERE / 'xml-bridge.c']
exports = ['_kana_xml_open', '_kana_xml_feed', '_kana_xml_failure', '_kana_xml_error', '_kana_xml_skipped_subsets', '_kana_xml_close', '_malloc', '_free']
arguments = ['-O2', '-std=c99', '-DHAVE_EXPAT_CONFIG_H', '-I' + str(HERE), '-I' + str(SOURCE / 'lib'),
             *map(str, inputs), '--no-entry', '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sENVIRONMENT=web,worker,node',
             '-sALLOW_MEMORY_GROWTH=1', '-sINITIAL_MEMORY=16777216', '-sMAXIMUM_MEMORY=67108864', '-sEXPORTED_RUNTIME_METHODS=["HEAPU8"]',
             '-sEXPORTED_FUNCTIONS=' + json.dumps(exports), '-o', str(BUILD / 'expat.mjs')]
run = subprocess.run([sys.executable, str(Path(toolchain['compiler']) / 'emcc.py'), *arguments], env=environment,
                     capture_output=True, text=True)
if run.returncode: raise RuntimeError('XML candidate build failed:\n' + run.stderr)
shutil.copyfile(SOURCE / 'COPYING', BUILD / 'COPYING')
write_receipt(HERE / 'xml-build-contract.json', {'version': '2.9.0', 'candidateOnly': True, 'arguments': arguments,
    'upstreamFilesModified': False, 'upstreamInputs': upstream_inputs,
    'toolchainReceiptSha256': hashlib.sha256((HERE.parent / 'kana-rar/toolchain-input.json').read_bytes()).hexdigest(),
    'inputs': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs + [HERE / 'expat_config.h']},
    'outputs': {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in BUILD.iterdir() if p.is_file()}})
print(json.dumps({'built': True, 'wasmBytes': (BUILD / 'expat.wasm').stat().st_size}))
