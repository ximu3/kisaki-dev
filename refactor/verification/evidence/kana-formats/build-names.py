"""Build an isolated source-name hook; keep the upstream baseline and previous proofs intact."""
from pathlib import Path
import difflib
import hashlib
import json
import os
import shutil
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BASE = HERE.parent / 'kana-rar'
CACHE = ROOT / 'node_modules/.cache/kana-formats'
BUILD = CACHE / 'names-build'
BUILD.mkdir(exist_ok=True)
sys.path.insert(0, str(BASE))
from record import write_receipt
base = json.loads((BASE / 'build-contract.json').read_text(encoding='utf-8'))
toolchain = json.loads((BASE / 'toolchain-input.json').read_text(encoding='utf-8'))
for name, expected in base['inputs'].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected
source = ROOT / 'node_modules/.cache/kana-rar/upstream/unrar/arcread.cpp'
original = source.read_text(encoding='utf-8')
patched = original.replace('#include "rar.hpp"', '''#include "rar.hpp"
extern "C" void kana_raw_name(int,int,int,const unsigned char*,unsigned,unsigned);
extern "C" void kana_name_length(double);
extern "C" void kana_decoded_name(const wchar_t*,unsigned);
extern "C" void kana_raw_target(const unsigned char*,unsigned);''', 1)
needle = '        Raw.GetB((byte *)&FileName[0],ReadNameSize);'
assert patched.count(needle) == 2
patched = patched.replace(needle, needle + '\n        if (FileBlock) kana_raw_name(Format==RARFMT50 ? 5 : 3,hd->HostOS,hd->Flags,(const unsigned char*)FileName.data(),ReadNameSize,NameSize);')
needle = '        size_t NameSize=(size_t)Raw.GetV();'
assert patched.count(needle) == 1
patched = patched.replace(needle, '        uint64 SourceNameSize=Raw.GetV();\n        if (FileBlock) kana_name_length((double)SourceNameSize);\n        size_t NameSize=(size_t)SourceNameSize;')
needle = '          ConvertNameCase(hd->FileName);'
assert patched.count(needle) == 2
patched = patched.replace(needle, '          kana_decoded_name(hd->FileName.data(),hd->FileName.size());\n' + needle)
needle = '              Raw->GetB(&UtfName[0],NameSize);'
assert patched.count(needle) == 1
patched = patched.replace(needle, needle + '\n              kana_raw_target((const unsigned char*)UtfName.data(),NameSize);')
changed = BUILD / 'arcread.cpp'
changed.write_text(patched, encoding='utf-8', newline='\n')
(HERE / 'raw-name-hook.patch').write_text(''.join(difflib.unified_diff(original.splitlines(True), patched.splitlines(True), fromfile='a/arcread.cpp', tofile='b/arcread.cpp')), encoding='utf-8', newline='\n')
environment = dict(os.environ)
environment['EM_CONFIG'] = toolchain['config']
compiler = [sys.executable, str(Path(toolchain['compiler']) / 'em++.py')]
objects = []
for item in [changed, HERE / 'names-bridge.cpp']:
    target = BUILD / (item.stem + '.o')
    run = subprocess.run([*compiler, *base['compileFlags'], '-c', str(item), '-o', str(target)], env=environment, capture_output=True, text=True)
    if run.returncode: raise RuntimeError('Source name hook compilation failed:\n' + run.stderr)
    objects.append(str(target))
arguments = [arg for arg in base['linkArguments'] if not any(arg.endswith(name) for name in ['dll.o', 'bridge.o', 'arcread.o'])]
arguments[arguments.index('--no-entry'):arguments.index('--no-entry')] = objects
arguments[arguments.index('-o') + 1] = str(BUILD / 'unrar.mjs')
for index, arg in enumerate(arguments):
    if arg.startswith('-sEXPORTED_FUNCTIONS='):
        exports = json.loads(arg.split('=', 1)[1])
        exports += ['_kana_set_utf8_locale', '_kana_reference_in_data', '_kana_reference_target', '_kana_reference_directory', '_kana_windows_names', '_kana_process_reference']
        arguments[index] = '-sEXPORTED_FUNCTIONS=' + json.dumps(exports)
run = subprocess.run([*compiler, *arguments], env=environment, capture_output=True, text=True)
if run.returncode: raise RuntimeError('Source name hook linking failed:\n' + run.stderr)
shutil.copyfile(ROOT / 'node_modules/.cache/kana-rar/build/license.txt', BUILD / 'license.txt')
write_receipt(HERE / 'names-build-contract.json', {'baseBuildSha256': hashlib.sha256((BASE / 'build-contract.json').read_bytes()).hexdigest(),
    'upstreamBaselineModified': False, 'privateSourceCopyPatched': True, 'candidateOnly': True,
    'originalSourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'patchedSourceSha256': hashlib.sha256(changed.read_bytes()).hexdigest(),
    'patchSha256': hashlib.sha256((HERE / 'raw-name-hook.patch').read_bytes()).hexdigest(),
    'bridgeSha256': hashlib.sha256((HERE / 'names-bridge.cpp').read_bytes()).hexdigest(),
    'includedMemberBridgeSha256': hashlib.sha256((HERE.parent / 'kana-rar-members/member-bridge.cpp').read_bytes()).hexdigest(),
    'arguments': arguments, 'outputs': {name: {'bytes': (BUILD / name).stat().st_size, 'sha256': hashlib.sha256((BUILD / name).read_bytes()).hexdigest()} for name in ['unrar.mjs', 'unrar.wasm', 'license.txt']}})
print(json.dumps({'wasmBytes': (BUILD / 'unrar.wasm').stat().st_size, 'upstreamBaselineModified': False}))
