"""Compare Chromium consumers of the existing native PQ reference frames."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import math
import os
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/libmpv-design/display'
CACHE.mkdir(parents=True, exist_ok=True)
inputs = json.loads((HERE.parent / 'libmpv-gpu/binary-input.json').read_text(encoding='utf-8'))
native = json.loads((HERE.parent / 'libmpv-gpu/native-contract.json').read_text(encoding='utf-8'))
binary = json.loads((HERE.parent / 'libmpv-native/binary-input.json').read_text(encoding='utf-8'))
previous = json.loads((HERE.parent / 'libmpv-playback/renderer-contract.json').read_text(encoding='utf-8'))
addon = ROOT / 'node_modules/.cache/libmpv-design/gpu-target/libmpv-gpu-probe.node'
capture = ROOT / 'node_modules/.cache/libmpv-design/display-target/debug/libmpv-display-capture-probe.exe'
digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
assert digest(addon) == native['addonSha256']
assert digest(binary['dll']) == binary['dllSha256']
assert digest(previous['sample']['path']) == previous['sample']['sha256']
assert digest(inputs['sample']['path']) == inputs['sample']['sha256']
build = subprocess.run(['cargo', 'build', '--offline', '--manifest-path', str(HERE / 'Cargo.toml'),
    '--target-dir', str(ROOT / 'node_modules/.cache/libmpv-design/display-target')],
    cwd=ROOT, capture_output=True, text=True, timeout=60, creationflags=subprocess.CREATE_NO_WINDOW)
if build.returncode:
    raise RuntimeError(f'Capture helper build failed.\n{build.stderr}')
output = CACHE / 'last-run.json'
environment = dict(os.environ)
environment.pop('ELECTRON_RUN_AS_NODE', None)
result = subprocess.run([
    str(Path(inputs['electron']['runtime']) / 'electron.exe'), str(HERE / 'main.cjs'),
    str(addon), binary['dll'], inputs['sample']['path'], previous['sample']['path'],
    str(output), str(CACHE / 'electron-user-data'), str(capture)
], cwd=ROOT, env=environment, capture_output=True, text=True, timeout=40,
    creationflags=subprocess.CREATE_NO_WINDOW)
if result.returncode:
    raise RuntimeError(f'Display probe failed ({result.returncode}).\n{result.stdout}\n{result.stderr}')
assert output.exists(), f'Missing display receipt.\n{result.stdout}\n{result.stderr}'
receipt = json.loads(output.read_text(encoding='utf-8'))
assert not result.stderr, result.stderr
assert receipt['allReferencesReleasedBeforeWindowClose']
for case in receipt['cases']:
    assert case['releaseCount'] == 1
    assert case['colorSpace'] == case['video']['colorSpace']
    assert case['colorSpace']['transfer'] == 'pq'
    assert case['video']['readyState'] == 4
    assert case['video']['compositor']['format'] == 'rgba16float'
    for canvas in [case['srgbCanvas'], case['p3Canvas'], case['video']['srgbCanvas'], case['video']['p3Canvas']]:
        assert canvas['pixelFormat'] == 'rgba-float16'
        assert canvas['attributes']['toneMapping']['mode'] == 'standard'
        assert all(math.isfinite(value) for pixel in canvas['samples'] for value in pixel)
    assert all(math.isfinite(value) for pixel in case['video']['compositor']['samples'] for value in pixel)
    assert all(pixel[3] == 1 for pixel in case['video']['compositor']['samples'])
receipt.update({
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'addonSha256': digest(addon), 'dllSha256': binary['dllSha256'],
    'captureExecutableSha256': digest(capture),
    'samples': [inputs['sample'], previous['sample']],
    'sources': {name: digest(HERE / name) for name in ['main.cjs', 'preload.cjs', 'run.py', 'capture.cpp', 'build.rs', 'main.rs', 'Cargo.toml', 'Cargo.lock', '../libmpv-playback/renderer.html']},
    'nativeVideoFrameDelivered': True,
    'productionDisplayPathVerified': False,
    'continuousLeaseRecyclingVerified': False,
    'stdout': result.stdout, 'stderr': result.stderr
})
output.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'capabilities': receipt['capabilities'], 'cases': [
    {'input': case['input'], 'compositor': case['video']['compositor'],
     'releaseCount': case['releaseCount']} for case in receipt['cases']]}))
