"""Check native playback replacement without changing the shared graphics probe."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import shutil
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/libmpv-design/playback'
TARGET = ROOT / 'node_modules/.cache/libmpv-design/playback-target'
CACHE.mkdir(parents=True, exist_ok=True)


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def execute(arguments, timeout):
    result = subprocess.run(arguments, cwd=ROOT, capture_output=True, text=True,
                            timeout=timeout, creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        raise RuntimeError(f'Playback probe failed ({result.returncode}).\n{result.stdout}\n{result.stderr}')
    return result


binary = json.loads((HERE.parent / 'libmpv-native/binary-input.json').read_text(encoding='utf-8'))
graphics = json.loads((HERE.parent / 'libmpv-gpu/binary-input.json').read_text(encoding='utf-8'))
assert digest(binary['dll']) == binary['dllSha256']
for header in graphics['directD3d11Headers']['files']:
    assert digest(ROOT / 'node_modules/.cache/libmpv-design/graphics/include/mpv' / header['path']) == header['sha256']
ffmpeg = shutil.which('ffmpeg')
assert ffmpeg
samples = []
for color in ['red', 'blue']:
    sample = CACHE / f'{color}.mkv'
    execute([ffmpeg, '-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i',
             f'color=c={color}:s=64x48:r=24:d=2', '-an', '-c:v', 'ffv1',
             '-level', '3', '-pix_fmt', 'yuv444p', '-fflags', '+bitexact',
             '-flags:v', '+bitexact', str(sample)], 15)
    samples.append({'path': str(sample), 'sha256': digest(sample)})
missing = CACHE / 'missing-input.mkv'
assert not missing.exists()
execute(['cargo', 'generate-lockfile', '--offline', '--manifest-path', str(HERE / 'Cargo.toml')], 30)
execute(['cargo', 'build', '--offline', '--locked', '--manifest-path', str(HERE / 'Cargo.toml'),
         '--target-dir', str(TARGET)], 120)
executable = TARGET / 'debug/libmpv-playback-probe.exe'
result = execute([str(executable), binary['dll'], *[item['path'] for item in samples], str(missing)], 35)
receipt = json.loads(result.stdout)
receipt.update({
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'dllSha256': binary['dllSha256'], 'executableSha256': digest(executable),
    'sharedProducerSha256': digest(HERE.parent / 'libmpv-gpu/producer.cpp'),
    'generatorSha256': digest(ffmpeg), 'samples': samples,
    'sources': {name: digest(HERE / name) for name in ['Cargo.toml', 'Cargo.lock', 'build.rs', 'main.rs', 'playback.cpp', 'run.py']},
    'nativeD3d11PlaybackExecuted': True, 'nodeDeliveryExecuted': False,
    'electronDeliveryExecuted': False, 'hardwareDecodingExecuted': False,
    'physicalHdrDisplayVerified': False, 'stderr': result.stderr,
})
(HERE / 'native-contract.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'cases': len(receipt['cases']), 'nativeD3d11PlaybackExecuted': True,
                  'seekPositions': [case['seekPosition'] for case in receipt['cases']]}))
