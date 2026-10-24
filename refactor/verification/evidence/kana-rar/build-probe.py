"""Compile the fixed UnRAR source and a narrow bridge with an isolated Emscripten SDK."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
from record import write_receipt

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-rar'
SOURCE = CACHE / 'upstream/unrar'
BUILD = CACHE / 'build'
BUILD.mkdir(exist_ok=True)
source_archive = CACHE.parent / 'kana-design/sources/unrarsrc-7.2.7.tar.gz'
verified_source_files = 0
with tarfile.open(source_archive) as archive:
    for member in archive.getmembers():
        if not member.isfile():
            continue
        path = (CACHE / 'upstream' / member.name).resolve()
        if not path.is_relative_to(SOURCE.resolve()) or path.read_bytes() != archive.extractfile(member).read():
            raise RuntimeError('Upstream source differs from the fixed archive')
        verified_source_files += 1
toolchain = json.loads((HERE / 'toolchain-input.json').read_text(encoding='utf-8'))
compiler = Path(toolchain['compiler']) / 'em++.py'
environment = dict(os.environ)
environment['EM_CONFIG'] = toolchain['config']
makefile = (SOURCE / 'makefile').read_text(encoding='utf-8').replace('\\\n', ' ')
objects = re.search(r'^OBJECTS=(.*)$', makefile, re.MULTILINE).group(1).split()
objects += re.search(r'^LIB_OBJ=(.*)$', makefile, re.MULTILINE).group(1).split()
sources = [SOURCE / (name.removesuffix('.o') + '.cpp') for name in dict.fromkeys(objects)] + [HERE / 'bridge.cpp']
flags = ['-O2', '-std=c++11', '-DRARDLL', '-D_UNIX', '-D_FILE_OFFSET_BITS=64', '-D_LARGEFILE_SOURCE',
         '-fexceptions', '-I' + str(SOURCE), '-Wno-dangling-else', '-Wno-unused-result']


def compile_one(source):
    output = BUILD / (source.stem + '.o')
    command = [sys.executable, str(compiler), *flags, '-c', str(source), '-o', str(output)]
    result = subprocess.run(command, env=environment, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f'Compilation failed for {source.name}:\n{result.stdout}\n{result.stderr}')
    return output


with ThreadPoolExecutor(max_workers=4) as executor:
    compiled = list(executor.map(compile_one, sources))
print(json.dumps({'compiledSources': len(compiled)}), flush=True)
exports = ['_kana_open', '_kana_next', '_kana_process', '_kana_close', '_kana_name', '_kana_flags',
           '_kana_archive_flags', '_kana_crc', '_kana_hash_type', '_kana_dictionary', '_kana_unpacked_size',
           '_kana_heap_bytes', '_kana_redirection', '_malloc', '_free']
output = BUILD / 'unrar.mjs'
command = [sys.executable, str(compiler), *flags, *map(str, compiled), '--no-entry', '-o', str(output),
           '-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sENVIRONMENT=worker,node', '-sALLOW_MEMORY_GROWTH=1',
           '-sINITIAL_MEMORY=33554432', '-sMAXIMUM_MEMORY=268435456', '-sSTACK_SIZE=1048576',
           '-sASYNCIFY=1', '-sASYNCIFY_STACK_SIZE=65536', '-sASSERTIONS=2', '--profiling-funcs',
           '--js-library', str(HERE / 'async-input.js'), '-sABORTING_MALLOC=0',
           '-sEXPORTED_FUNCTIONS=' + json.dumps(exports),
           '-sEXPORTED_RUNTIME_METHODS=' + json.dumps(['FS', 'ccall', 'UTF8ToString', 'Asyncify'])]
result = subprocess.run(command, env=environment, capture_output=True, text=True)
if result.returncode:
    raise RuntimeError(f'Linking failed:\n{result.stdout}\n{result.stderr}')
shutil.copyfile(SOURCE / 'license.txt', BUILD / 'license.txt')
receipt = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'unrarVersion': '7.23',
           'emscriptenVersion': toolchain['version'], 'sourceCount': len(sources),
           'sourceArchive': {'path': str(source_archive.relative_to(ROOT)),
                             'sha256': hashlib.sha256(source_archive.read_bytes()).hexdigest(),
                             'verifiedUnmodifiedFiles': verified_source_files},
           'upstreamSourcesModified': False, 'compileFlags': flags, 'linkArguments': command[2:],
           'inputs': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                      for p in [*sources, HERE / 'async-input.js']},
           'outputs': {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                       for p in [output, output.with_suffix('.wasm'), BUILD / 'license.txt']},
           'decoderExecuted': False}
write_receipt(HERE / 'build-contract.json', receipt)
print(json.dumps({'built': list(receipt['outputs']), 'wasmBytes': receipt['outputs']['unrar.wasm']['bytes']}))
