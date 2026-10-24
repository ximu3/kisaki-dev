"""Build a new input-entry proof from the unchanged XML and approved codec inputs."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache'
BUILD = CACHE / 'kana-xml-entry/build'
BUILD.mkdir(parents=True, exist_ok=True)
codec_build = CACHE / 'kana-xml-codecs/build'
codec_source = CACHE / 'kana-xml-codecs/libiconv-1.19'
xml_source = CACHE / 'kana-formats/expat-source/libexpat-e127b43ac1f514e0b320508893aa338ecd5e72be/expat'
old = json.loads((HERE.parent / 'kana-xml-codecs/build-contract.json').read_text(encoding='utf-8'))
hash_file = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assert hash_file(codec_build / 'private-lib/cp932.h') == old['cp932Adaptation']['adaptedSha256']
toolchain_file = HERE.parent / 'kana-rar/toolchain-input.json'
toolchain = json.loads(toolchain_file.read_text(encoding='utf-8'))
environment = dict(os.environ)
environment['EM_CONFIG'] = toolchain['config']
common = ['-O2', '-std=c99', '--no-entry', '-sMODULARIZE=1', '-sEXPORT_ES6=1',
          '-sENVIRONMENT=web,worker,node', '-sALLOW_MEMORY_GROWTH=1',
          '-sMAXIMUM_MEMORY=67108864', '-sEXPORTED_RUNTIME_METHODS=["HEAPU8"]']
codec_exports = ['_kana_codec_open', '_kana_codec_convert', '_kana_codec_consumed',
                 '_kana_codec_produced', '_kana_codec_close', '_kana_codec_active',
                 '_kana_codec_list', '_malloc', '_free']
xml_exports = ['_kana_entry_declaration', '_kana_entry_open', '_kana_entry_active', '_kana_xml_feed', '_kana_xml_failure',
               '_kana_xml_error', '_kana_xml_catalog_uses', '_kana_xml_close', '_malloc', '_free']
xml_inputs = [xml_source / 'lib' / name for name in ['xmlparse.c', 'xmltok.c', 'xmlrole.c', 'xcs.c', 'random_getentropy.c']]
commands = {
    'codec': common + ['-sINITIAL_MEMORY=2097152', '-I' + str(codec_build), '-I' + str(codec_source / 'srclib'),
                       str(codec_build / 'private-lib/iconv.c'), str(HERE / 'codec.c'),
                       '-sEXPORTED_FUNCTIONS=' + json.dumps(codec_exports), '-o', str(BUILD / 'codec.mjs')],
    'xml': common + ['-sINITIAL_MEMORY=16777216', '-DHAVE_EXPAT_CONFIG_H',
                     '-I' + str(HERE.parent / 'kana-formats'), '-I' + str(xml_source / 'lib'),
                     *map(str, xml_inputs), str(HERE / 'xml.c'),
                     '-sEXPORTED_FUNCTIONS=' + json.dumps(xml_exports), '-o', str(BUILD / 'xml.mjs')]
}
for name, arguments in commands.items():
    result = subprocess.run([sys.executable, str(Path(toolchain['compiler']) / 'emcc.py'), *arguments],
                            env=environment, capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        raise RuntimeError('XML entry build failed:\n' + result.stderr)
report = {
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'toolchainReceiptSha256': hash_file(toolchain_file),
    'sources': {p.name: hash_file(p) for p in [HERE / 'build.py', HERE / 'codec.c', HERE / 'xml.c']},
    'inputs': {str(p.relative_to(ROOT)): hash_file(p) for p in
               [HERE.parent / 'kana-xml-codecs/bridge.c', HERE.parent / 'kana-xml-input/bridge.c',
                codec_build / 'private-lib/iconv.c', codec_build / 'private-lib/cp932.h',
                codec_build / 'config.h', codec_build / 'iconv.h', *xml_inputs]},
    'arguments': commands,
    'outputs': {name: {'bytes': (BUILD / name).stat().st_size, 'sha256': hash_file(BUILD / name)}
                for name in ['codec.mjs', 'codec.wasm', 'xml.mjs', 'xml.wasm']},
    'previousProbesModified': False,
    'productionImplementation': False
}
(HERE / 'build-contract.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'codec': (BUILD / 'codec.wasm').stat().st_size, 'xml': (BUILD / 'xml.wasm').stat().st_size}))
