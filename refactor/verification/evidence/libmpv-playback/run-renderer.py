"""Inspect imported PQ frames in an unflagged, hidden Electron display context."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import math
import os
import shutil
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/libmpv-design/playback'
CACHE.mkdir(parents=True, exist_ok=True)
inputs = json.loads((HERE.parent / 'libmpv-gpu/binary-input.json').read_text(encoding='utf-8'))
native = json.loads((HERE.parent / 'libmpv-gpu/native-contract.json').read_text(encoding='utf-8'))
binary = json.loads((HERE.parent / 'libmpv-native/binary-input.json').read_text(encoding='utf-8'))
addon = ROOT / 'node_modules/.cache/libmpv-design/gpu-target/libmpv-gpu-probe.node'
digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
assert digest(addon) == native['addonSha256']
assert digest(binary['dll']) == binary['dllSha256']
ffmpeg = shutil.which('ffmpeg')
assert ffmpeg
sample = CACHE / 'pq-1000-nit.mkv'
generated = subprocess.run([ffmpeg, '-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i',
    'color=c=white:s=64x48:r=1:d=1', '-vf', 'format=yuv420p10le,geq=lum=723:cb=512:cr=512',
    '-color_range', 'tv', '-color_primaries', 'bt2020', '-color_trc', 'smpte2084',
    '-colorspace', 'bt2020nc', '-an', '-c:v', 'libx265', '-pix_fmt', 'yuv420p10le',
    '-x265-params', 'lossless=1:keyint=1:repeat-headers=1:log-level=error:pools=1:frame-threads=1:'
    'master-display=G(8500,39850)B(6550,2300)R(35400,14600)WP(15635,16450)L(10000000,50):max-cll=1000,1000',
    '-fflags', '+bitexact', '-flags:v', '+bitexact', str(sample)],
    cwd=ROOT, capture_output=True, text=True, timeout=15, creationflags=subprocess.CREATE_NO_WINDOW)
if generated.returncode:
    raise RuntimeError(f'Failed to generate the PQ reference.\n{generated.stderr}')
ffprobe = shutil.which('ffprobe')
assert ffprobe
description = subprocess.run([ffprobe, '-v', 'error', '-read_intervals', '%+#1',
    '-select_streams', 'v:0', '-show_frames', '-of', 'json', str(sample)],
    capture_output=True, text=True, timeout=10, check=True, creationflags=subprocess.CREATE_NO_WINDOW)
frame = json.loads(description.stdout)['frames'][0]
assert frame['color_transfer'] == 'smpte2084' and frame['color_primaries'] == 'bt2020'
metadata = [item for item in frame['side_data_list'] if item['side_data_type'] in
            ['Mastering display metadata', 'Content light level metadata']]
assert len(metadata) == 2
output = HERE / 'renderer-contract.json'
environment = dict(os.environ)
environment.pop('ELECTRON_RUN_AS_NODE', None)
result = subprocess.run([
    str(Path(inputs['electron']['runtime']) / 'electron.exe'), str(HERE / 'renderer-main.cjs'),
    str(addon), binary['dll'], inputs['sample']['path'], str(sample), str(output),
    str(CACHE / 'electron-user-data')
], cwd=ROOT, env=environment, capture_output=True, text=True, timeout=35,
    creationflags=subprocess.CREATE_NO_WINDOW)
if result.returncode:
    raise RuntimeError(f'Renderer probe failed ({result.returncode}).\n{result.stdout}\n{result.stderr}')
receipt = json.loads(output.read_text(encoding='utf-8'))


def pq_nits(value):
    m1, m2 = 2610 / 16384, 2523 / 32
    c1, c2, c3 = 3424 / 4096, 2413 / 128, 2392 / 128
    power = value ** (1 / m2)
    return 10000 * (max(power - c1, 0) / (c2 - c3 * power)) ** (1 / m1)


for case, expected, tolerance in zip(receipt['cases'], [203, 1000], [2, 20]):
    actual = pq_nits(case['nativePixel'][0])
    assert abs(actual - expected) < tolerance
    case['nativeEncodedWhiteNits'] = actual
    assert case['colorSpace']['transfer'] == 'pq'
    assert case['colorSpace']['primaries'] == 'bt2020'
    assert case['releaseCount'] == 1
    if case['webgpu']['supported']:
        assert all(math.isfinite(value) for pixel in case['webgpu']['samples'] for value in pixel)
        assert all(pixel[3] == 1 for pixel in case['webgpu']['samples'])
receipt.update({
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'addonSha256': digest(addon), 'dllSha256': binary['dllSha256'],
    'sample': {'path': str(sample), 'sha256': digest(sample), 'pqLumaCode': 723,
               'bitDepth': 10, 'codec': 'hevc', 'metadata': metadata},
    'generatorSha256': digest(ffmpeg),
    'nativeHdrReferenceVerified': True,
    'webGpuImportExecuted': all(case['webgpu']['supported'] for case in receipt['cases']),
    'webGpuColorConversionVerified': False,
    'hdrRangePreservationVerified': False,
    'sources': {name: digest(HERE / name) for name in ['renderer-main.cjs', 'renderer-preload.cjs', 'renderer.html', 'run-renderer.py']},
    'stdout': result.stdout, 'stderr': result.stderr,
})
output.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'electron': receipt['electron'], 'display': receipt['display'],
                  'capabilities': receipt['capabilities'], 'cases': receipt['cases']}))
