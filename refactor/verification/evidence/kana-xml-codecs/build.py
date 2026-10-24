"""Build an isolated named-codec candidate and a forced-UTF-8 Expat probe from fixed sources."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-xml-codecs'
BUILD = CACHE / 'build'
BUILD.mkdir(parents=True, exist_ok=True)
URL = 'https://ftp.gnu.org/pub/gnu/libiconv/libiconv-1.19.tar.gz'
EXPECTED = '88dd96a8c0464eca144fc791ae60cd31cd8ee78321e67397e25fc095c4a19aa6'
archive_path = CACHE / 'libiconv-1.19.tar.gz'
if not archive_path.exists():
    payload = urllib.request.urlopen(URL, timeout=45).read(12 * 1024 * 1024)
    assert hashlib.sha256(payload).hexdigest() == EXPECTED
    archive_path.write_bytes(payload)
assert hashlib.sha256(archive_path.read_bytes()).hexdigest() == EXPECTED
with tarfile.open(archive_path) as archive:
    for member in archive.getmembers():
        if not member.isfile():
            continue
        target = (CACHE / member.name).resolve()
        assert target.is_relative_to(CACHE.resolve())
        payload = archive.extractfile(member).read()
        if target.exists():
            assert target.read_bytes() == payload, member.name
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
SOURCE = CACHE / 'libiconv-1.19'
header = (SOURCE / 'include/iconv.h.in').read_text(encoding='utf-8')
for name, value in {'DLL_VARIABLE': '', 'EILSEQ': '84', 'ICONV_CONST': 'const',
                    'USE_MBSTATE_T': '1', 'BROKEN_WCHAR_H': '0'}.items():
    header = header.replace('@' + name + '@', value)
assert '@' not in header
(BUILD / 'iconv.h').write_text(header, encoding='utf-8', newline='\n')
(BUILD / 'config.h').write_text(
    '#define ENABLE_EXTRA 0\n#define ICONV_CONST const\n#define WORDS_LITTLEENDIAN 1\n'
    '#define HAVE_MBRTOWC 1\n#define HAVE_WCRTOMB 1\n#define HAVE_STDDEF_H 1\n'
    '#define HAVE_STDLIB_H 1\n#define HAVE_STRING_H 1\n', encoding='utf-8', newline='\n')
toolchain_file = HERE.parent / 'kana-rar/toolchain-input.json'
toolchain = json.loads(toolchain_file.read_text(encoding='utf-8'))
environment = dict(os.environ)
environment['EM_CONFIG'] = toolchain['config']
common = ['-O2', '-std=c99', '--no-entry', '-sMODULARIZE=1', '-sEXPORT_ES6=1',
          '-sENVIRONMENT=web,worker,node', '-sALLOW_MEMORY_GROWTH=1',
          '-sINITIAL_MEMORY=16777216', '-sMAXIMUM_MEMORY=67108864',
          '-sEXPORTED_RUNTIME_METHODS=["HEAPU8"]']

def compile_source(arguments):
    process = subprocess.run([sys.executable, str(Path(toolchain['compiler']) / 'emcc.py'), *arguments],
                             env=environment, capture_output=True, text=True,
                             creationflags=subprocess.CREATE_NO_WINDOW)
    if process.returncode:
        raise RuntimeError('The isolated codec build failed:\n' + process.stderr)

exports = ['_kana_codec_open', '_kana_codec_convert', '_kana_codec_consumed',
           '_kana_codec_produced', '_kana_codec_close', '_kana_codec_active', '_malloc', '_free']
codec_flags = [argument.replace('-sINITIAL_MEMORY=16777216', '-sINITIAL_MEMORY=2097152')
               for argument in common]
original_arguments = codec_flags + ['-I' + str(BUILD), '-I' + str(SOURCE / 'srclib'),
                              str(SOURCE / 'lib/iconv.c'), str(HERE / 'bridge.c'),
                              '-sEXPORTED_FUNCTIONS=' + json.dumps(exports), '-o', str(BUILD / 'codec-original.mjs')]
compile_source(original_arguments)
private = BUILD / 'private-lib'
shutil.copytree(SOURCE / 'lib', private, dirs_exist_ok=True)
cp932 = (private / 'cp932.h').read_text(encoding='utf-8')
needle = '        unsigned char t1 = (s1 < 0xe0 ? s1-0x81 : s1-0xc1);'
assert cp932.count(needle) == 1
patch = (HERE / 'cp932.patch').read_text(encoding='utf-8')
addition = '\n'.join(line[1:] for line in patch.splitlines() if line.startswith('+') and not line.startswith('+++')) + '\n'
(private / 'cp932.h').write_text(cp932.replace(needle, addition + needle), encoding='utf-8', newline='\n')
codec_arguments = codec_flags + ['-I' + str(BUILD), '-I' + str(SOURCE / 'srclib'),
                           str(private / 'iconv.c'), str(HERE / 'bridge.c'),
                           '-sEXPORTED_FUNCTIONS=' + json.dumps(exports), '-o', str(BUILD / 'codec.mjs')]
compile_source(codec_arguments)

xml_here = HERE.parent / 'kana-xml-input'
xml_source = ROOT / 'node_modules/.cache/kana-formats/expat-source/libexpat-e127b43ac1f514e0b320508893aa338ecd5e72be/expat'
bridge_source = (xml_here / 'bridge.c').read_text(encoding='utf-8')
needle = r"XML_ParserCreateNS(NULL, '\x1f')"
assert bridge_source.count(needle) == 1
(BUILD / 'xml-bridge.c').write_text(bridge_source.replace(needle, r"""XML_ParserCreateNS("UTF-8", '\x1f')"""),
                                   encoding='utf-8', newline='\n')
xml_exports = ['_kana_xml_open', '_kana_xml_feed', '_kana_xml_failure', '_kana_xml_error',
               '_kana_xml_skipped_subsets', '_kana_xml_catalog_uses', '_kana_xml_external_declarations',
               '_kana_xml_close', '_malloc', '_free']
xml_inputs = [xml_source / 'lib' / name for name in ['xmlparse.c', 'xmltok.c', 'xmlrole.c', 'xcs.c', 'random_getentropy.c']]
xml_arguments = common + ['-DHAVE_EXPAT_CONFIG_H', '-I' + str(HERE.parent / 'kana-formats'),
                          '-I' + str(xml_source / 'lib'), *map(str, xml_inputs), str(BUILD / 'xml-bridge.c'),
                          '-sEXPORTED_FUNCTIONS=' + json.dumps(xml_exports), '-o', str(BUILD / 'xml.mjs')]
compile_source(xml_arguments)
hash_file = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
report = {
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'candidateOnly': True,
    'source': {'url': URL, 'bytes': archive_path.stat().st_size, 'sha256': EXPECTED,
               'version': '1.19', 'license': 'LGPL-2.1-or-later', 'upstreamArchiveModified': False},
    'toolchainReceiptSha256': hash_file(toolchain_file),
    'sources': {file.name: hash_file(file) for file in [HERE / 'bridge.c', HERE / 'build.py', HERE / 'cp932.patch']},
    'cp932Adaptation': {'originalSha256': hash_file(SOURCE / 'lib/cp932.h'),
                       'adaptedSha256': hash_file(private / 'cp932.h'),
                       'purpose': 'Use the six Microsoft CP932 mappings that upstream intentionally substitutes.'},
    'inputs': {str(file.relative_to(ROOT)): hash_file(file)
               for file in [*xml_inputs, xml_here / 'bridge.c', SOURCE / 'lib/iconv.c', SOURCE / 'COPYING.LIB']},
    'arguments': {'originalCodec': original_arguments, 'codec': codec_arguments, 'xml': xml_arguments},
    'outputs': {file.name: {'bytes': file.stat().st_size, 'sha256': hash_file(file)}
                for file in BUILD.iterdir() if file.is_file()},
    'workspaceDependenciesChanged': False,
    'previousXmlProbeModified': False
}
(HERE / 'build-contract.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'codecWasmBytes': (BUILD / 'codec.wasm').stat().st_size,
                  'xmlWasmBytes': (BUILD / 'xml.wasm').stat().st_size}))
