"""Compare native and browser mapping with a generated seven-step PQ reference."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import importlib.util
import json
import math
import os
import shutil
import struct
import subprocess
import sys
import time

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/libmpv-design/tonemapping'
CACHE.mkdir(parents=True, exist_ok=True)
digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
inputs = json.loads((HERE.parent / 'libmpv-gpu/binary-input.json').read_text())
native = json.loads((HERE.parent / 'libmpv-gpu/native-contract.json').read_text())
binary = json.loads((HERE.parent / 'libmpv-native/binary-input.json').read_text())
previous = json.loads((HERE.parent / 'libmpv-display/hdr-contract.json').read_text())
addon = ROOT / 'node_modules/.cache/libmpv-design/gpu-target/libmpv-gpu-probe.node'
capture = ROOT / 'node_modules/.cache/libmpv-design/display-target/debug/libmpv-display-capture-probe.exe'
assert digest(addon) == native['addonSha256']
assert digest(binary['dll']) == binary['dllSha256']
assert digest(capture) == previous['captureExecutableSha256']

levels = [0.1, 10, 100, 203, 400, 1000, 4000]


def pq(value):
    power = (value / 10000) ** (2610 / 16384)
    return ((3424 / 4096 + (2413 / 128) * power) / (1 + (2392 / 128) * power)) ** (2523 / 32)


def nits(value):
    power = value ** (32 / 2523)
    return 10000 * (max(power - 3424 / 4096, 0) / (2413 / 128 - (2392 / 128) * power)) ** (16384 / 2610)


codes = [round(64 + 876 * pq(value)) for value in levels]
row = b''.join(struct.pack('<H', code) * 32 for code in codes)
raw = CACHE / 'steps.yuv'
raw.write_bytes(row * 64 + struct.pack('<H', 512) * (224 * 64 // 2))
sample = CACHE / 'steps-pq-4000.mkv'
ffmpeg = shutil.which('ffmpeg')
assert ffmpeg
def generate(raw_path, destination):
    generation = subprocess.run([ffmpeg, '-v', 'error', '-nostdin', '-y', '-f', 'rawvideo',
    '-pixel_format', 'yuv420p10le', '-video_size', '224x64', '-framerate', '1', '-i', str(raw_path),
    '-frames:v', '1', '-color_range', 'tv', '-color_primaries', 'bt2020',
    '-color_trc', 'smpte2084', '-colorspace', 'bt2020nc', '-an', '-c:v', 'libx265',
    '-pix_fmt', 'yuv420p10le', '-x265-params',
    'lossless=1:keyint=1:repeat-headers=1:log-level=error:pools=1:frame-threads=1:'
    'master-display=G(8500,39850)B(6550,2300)R(35400,14600)WP(15635,16450)L(40000000,50):max-cll=4000,1000',
    '-fflags', '+bitexact', '-flags:v', '+bitexact', str(destination)],
    cwd=ROOT, capture_output=True, text=True, timeout=20, creationflags=subprocess.CREATE_NO_WINDOW)
    assert generation.returncode == 0, generation.stderr


generate(raw, sample)
color_values = [[100, 0, 0], [0, 100, 0], [0, 0, 100], [100, 100, 0],
                [0, 100, 100], [100, 0, 100], [100, 100, 100]]
color_codes = []
for values in color_values:
    red, green, blue = [pq(value) for value in values]
    luma = 0.2627 * red + 0.6780 * green + 0.0593 * blue
    color_codes.append([round(64 + 876 * luma),
                        round(512 + 896 * (blue - luma) / (2 * (1 - 0.0593))),
                        round(512 + 896 * (red - luma) / (2 * (1 - 0.2627)))])
color_raw = CACHE / 'colors.yuv'
color_raw.write_bytes(b''.join(
    b''.join(struct.pack('<H', value[channel]) * (32 if channel == 0 else 16)
             for value in color_codes) * (64 if channel == 0 else 32)
    for channel in range(3)))
color_sample = CACHE / 'colors-pq-4000.mkv'
generate(color_raw, color_sample)
ffprobe = shutil.which('ffprobe')
assert ffprobe
description = subprocess.run([ffprobe, '-v', 'error', '-read_intervals', '%+#1',
    '-select_streams', 'v:0', '-show_frames', '-of', 'json', str(sample)],
    capture_output=True, text=True, timeout=10, check=True, creationflags=subprocess.CREATE_NO_WINDOW)
source_frame = json.loads(description.stdout)['frames'][0]
assert source_frame['color_transfer'] == 'smpte2084' and source_frame['color_primaries'] == 'bt2020'
metadata = [item for item in source_frame['side_data_list'] if item['side_data_type'] in
            ['Mastering display metadata', 'Content light level metadata']]
assert len(metadata) == 2
reported_peak = previous['cases'][0]['video']['compositor']['dxgiDisplay']['maxLuminance']
peak = round(reported_peak)
display_receipt = json.loads((HERE.parent / 'libmpv-display/displays.json').read_text())
relative_white = display_receipt['active']['sdrWhiteNits']
cases = []
for mode, target in [('pq', 1000), ('pq', 4000), ('pq', peak), ('linear', peak), ('linear', 1000), ('linear', 100), ('linear-relative', peak), ('linear-relative', 100), ('bt2020-linear', peak), ('bt2020-colors', peak)]:
    name = f'{mode}-{target:g}'
    options = [('target-peak', str(target)), ('hdr-compute-peak', 'no')]
    relative = mode == 'linear-relative' or mode.startswith('bt2020-')
    unit = relative_white if relative else 80
    primaries = 'bt2020' if mode == 'pq' or mode.startswith('bt2020-') else 'bt709'
    source = color_sample if mode == 'bt2020-colors' else sample
    if mode != 'pq':
        shader = CACHE / f'{name}.glsl'
        factor = min(target, 203) / unit
        shader.write_text('//!HOOK OUTPUT\n//!BIND HOOKED\nvec4 hook() {\n'
            '    vec4 value = HOOKED_tex(HOOKED_pos);\n'
            f'    return vec4(value.rgb * {factor:.9f}, value.a);\n' + '}\n')
        options += [('target-trc', 'linear'), ('glsl-shaders', shader.as_posix())]
        if primaries == 'bt2020':
            options.append(('target-prim', 'bt.2020'))
    script = CACHE / f'{name}.lua'
    script.write_text('\n'.join(f'assert(mp.set_property({json.dumps(key)}, {json.dumps(value)}))'
        for key, value in options) + f'\nassert(mp.commandv("loadfile", {json.dumps(source.as_posix())}))\n')
    cases.append({'name': name, 'peakNits': target, 'script': str(script),
        'scriptSha256': digest(script), 'shaderSha256': digest(shader) if mode != 'pq' else None,
        'nitsPerUnit': unit if mode != 'pq' else None,
        'source': str(source), 'sourceSha256': digest(source),
        'referenceKind': 'colors' if mode == 'bt2020-colors' else 'steps',
        'nativeMode': 'pq' if mode == 'pq' else 'scrgb',
        'colorSpace': {'primaries': primaries,
                      'transfer': 'pq' if mode == 'pq' else ('linear-hdr' if relative else 'scrgb-linear-80-nits'), 'matrix': 'rgb', 'range': 'full'}})
output = CACHE / 'last-run.json'
manifest = {'addon': str(addon), 'dll': binary['dll'], 'sample': str(sample),
            'capture': str(capture), 'cases': cases, 'output': str(output),
            'userData': str(CACHE / 'electron-user-data')}
manifest_path = CACHE / 'input.json'
manifest_path.write_text(json.dumps(manifest))

display_source = HERE.parent / 'libmpv-playback/display-check.py'
spec = importlib.util.spec_from_file_location('display_check', display_source)
display = importlib.util.module_from_spec(spec)
spec.loader.exec_module(display)
hdr = sys.argv[1:] == ['--hdr-test', 'G24H2']
assert hdr or len(sys.argv) == 1
before = [record for record, _ in display.displays()]
original, _ = display.selected('G24H2')
checkpoint = CACHE / 'hdr-restore-state.json'
state = {'before': before, 'originalEnabled': original['advancedColorEnabled'], 'restorePending': hdr}
checkpoint.write_text(json.dumps(state, indent=2))
try:
    if hdr:
        active = display.set_enabled('G24H2', True)
        assert active['sdrWhiteNits'] == relative_white
        time.sleep(1)
    environment = dict(os.environ)
    environment.pop('ELECTRON_RUN_AS_NODE', None)
    result = subprocess.run([str(Path(inputs['electron']['runtime']) / 'electron.exe'),
        str(HERE / 'main.cjs'), str(manifest_path)], cwd=ROOT, env=environment,
        capture_output=True, text=True, timeout=55, creationflags=subprocess.CREATE_NO_WINDOW)
    assert result.returncode == 0, f'Display comparison failed.\n{result.stdout}\n{result.stderr}'
    assert not result.stderr, result.stderr
finally:
    if hdr:
        display.set_enabled('G24H2', original['advancedColorEnabled'])
    after = [record for record, _ in display.displays()]
    assert before == after, 'The display configuration was not restored.'
    state['restorePending'] = False
    state['after'] = after
    checkpoint.write_text(json.dumps(state, indent=2))

receipt = json.loads(output.read_text())
assert receipt['display']['label'] == 'G24H2'
assert receipt['capabilities']['dynamicRangeHigh'] == (hdr or original['advancedColorEnabled'])
for case in receipt['cases']:
    assert case['releaseCount'] == 1
    assert all(math.isfinite(value) for pixel in case['nativeSamples'] for value in pixel)
    assert all(math.isfinite(value) for pixel in case['compositor']['samples'] for value in pixel)
    setup = next(setup for setup in cases if setup['name'] == case['name'])
    case['nativeNits'] = [nits(pixel[0]) if case['name'].startswith('pq-') else pixel[0] * setup['nitsPerUnit'] for pixel in case['nativeSamples']]
    if case['referenceKind'] == 'colors':
        case['nativeRgbNits'] = [[value * setup['nitsPerUnit'] for value in pixel[:3]] for pixel in case['nativeSamples']]
    case['compositorLinearValues'] = [sum(pixel[:3]) / 3 for pixel in case['compositor']['samples'][:-1]]
    assert max(case['compositorLinearValues']) - min(case['compositorLinearValues']) > 0.1
receipt.update({'checkedAt': datetime.now(timezone.utc).isoformat(),
    'sources': {name: digest(HERE / name) for name in ['main.cjs', 'preload.cjs', 'run.py']},
    'sharedSources': {str(path.relative_to(HERE.parent)): digest(path) for path in
        [display_source, HERE.parent / 'libmpv-playback/renderer.html', HERE.parent / 'libmpv-display/capture.cpp']},
    'addonSha256': digest(addon), 'dllSha256': binary['dllSha256'],
    'captureExecutableSha256': digest(capture), 'generatorSha256': digest(ffmpeg),
    'reportedDisplayPeak': reported_peak,
    'reference': {'requestedNits': levels, 'codes': codes, 'encodedNits': [nits((code - 64) / 876) for code in codes],
                  'sampleSha256': digest(sample), 'metadata': metadata,
                  'colorRgbNits': color_values, 'colorYuvCodes': color_codes, 'colorSampleSha256': digest(color_sample)},
    'setups': cases, 'before': before, 'after': after, 'originalStateRestored': True,
    'outputHookDoesNotProveSubtitleConversion': True, 'stdout': result.stdout, 'stderr': result.stderr})
(HERE / ('hdr-contract.json' if hdr else 'sdr-contract.json')).write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'cases': [{'name': case['name'], 'nativeNits': case['nativeNits'],
    'compositor': case['compositorLinearValues'], 'colorSpace': case['colorSpace']} for case in receipt['cases']],
    'originalStateRestored': True}))
