"""Build the catalog-aware XML proof without modifying the previous candidate or upstream source."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-xml-input'
BUILD = CACHE / 'expat'
BUILD.mkdir(parents=True, exist_ok=True)
OLD = HERE.parent / 'kana-formats'
SOURCE_CACHE = ROOT / 'node_modules/.cache/kana-formats'
SOURCE = SOURCE_CACHE / 'expat-source/libexpat-e127b43ac1f514e0b320508893aa338ecd5e72be/expat'
toolchain_path = HERE.parent / 'kana-rar/toolchain-input.json'
toolchain = json.loads(toolchain_path.read_text(encoding='utf-8'))
upstream = {}
prefix = 'libexpat-e127b43ac1f514e0b320508893aa338ecd5e72be/expat/'
with tarfile.open(SOURCE_CACHE / 'expat.tar.gz') as archive:
    for member in archive.getmembers():
        if member.isfile() and member.name.startswith(prefix + 'lib/') and member.name.endswith(('.c', '.h')):
            relative = member.name[len(prefix):]
            payload = (SOURCE / relative).read_bytes()
            assert payload == archive.extractfile(member).read(), relative
            upstream[relative] = hashlib.sha256(payload).hexdigest()
inputs = [SOURCE / 'lib' / name for name in ['xmlparse.c', 'xmltok.c', 'xmlrole.c', 'xcs.c', 'random_getentropy.c']] + [HERE / 'bridge.c']
exports = ['_kana_xml_open', '_kana_xml_feed', '_kana_xml_failure', '_kana_xml_error',
           '_kana_xml_skipped_subsets', '_kana_xml_catalog_uses', '_kana_xml_external_declarations',
           '_kana_xml_close', '_malloc', '_free']
arguments = ['-O2', '-std=c99', '-DHAVE_EXPAT_CONFIG_H', '-I' + str(OLD), '-I' + str(SOURCE / 'lib'),
             *map(str, inputs), '--no-entry', '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sENVIRONMENT=web,worker,node',
             '-sALLOW_MEMORY_GROWTH=1', '-sINITIAL_MEMORY=16777216', '-sMAXIMUM_MEMORY=67108864',
             '-sEXPORTED_RUNTIME_METHODS=["HEAPU8"]', '-sEXPORTED_FUNCTIONS=' + json.dumps(exports),
             '-o', str(BUILD / 'expat.mjs')]
environment = dict(os.environ)
environment['EM_CONFIG'] = toolchain['config']
result = subprocess.run([sys.executable, str(Path(toolchain['compiler']) / 'emcc.py'), *arguments],
                        env=environment, capture_output=True, text=True,
                        creationflags=subprocess.CREATE_NO_WINDOW)
if result.returncode:
    raise RuntimeError('Catalog-aware XML proof build failed:\n' + result.stderr)
shutil.copyfile(SOURCE / 'COPYING', BUILD / 'COPYING')
record = {
    'recordedAt': datetime.now(timezone.utc).isoformat(), 'expatVersion': '2.9.0',
    'upstreamCommit': 'e127b43ac1f514e0b320508893aa338ecd5e72be',
    'upstreamFilesModified': False, 'previousProbeModified': False,
    'toolchainReceiptSha256': hashlib.sha256(toolchain_path.read_bytes()).hexdigest(),
    'arguments': arguments, 'upstreamInputs': upstream,
    'inputs': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
               for p in inputs + [OLD / 'expat_config.h', HERE / 'build.py']},
    'outputs': {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                for p in BUILD.iterdir() if p.is_file()},
}
(HERE / 'build-contract.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'built': True, 'wasmBytes': (BUILD / 'expat.wasm').stat().st_size}))
