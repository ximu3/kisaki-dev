"""Verify bounded live callbacks and shared-texture handoff using generated inputs."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/libmpv-design/handoff'
TARGET = ROOT / 'node_modules/.cache/libmpv-design/handoff-target'
CACHE.mkdir(parents=True, exist_ok=True)


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def execute(args, timeout):
    env = dict(os.environ)
    env.pop('ELECTRON_RUN_AS_NODE', None)
    result = subprocess.run(args, cwd=ROOT, env=env, capture_output=True, text=True,
                            timeout=timeout, creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        raise RuntimeError(f'Handoff probe failed ({result.returncode}).\n{result.stdout}\n{result.stderr}')
    return result


binary = json.loads((HERE.parent / 'libmpv-native/binary-input.json').read_text(encoding='utf-8'))
graphics = json.loads((HERE.parent / 'libmpv-gpu/binary-input.json').read_text(encoding='utf-8'))
playback = json.loads((HERE.parent / 'libmpv-playback/native-contract.json').read_text(encoding='utf-8'))
assert digest(binary['dll']) == binary['dllSha256']
assert digest(HERE.parent / 'libmpv-gpu/producer.cpp') == playback['sharedProducerSha256']
for header in graphics['directD3d11Headers']['files']:
    assert digest(ROOT / 'node_modules/.cache/libmpv-design/graphics/include/mpv' / header['path']) == header['sha256']
samples = playback['samples']
assert len(samples) == 2
for sample in samples:
    assert digest(sample['path']) == sample['sha256']
missing = CACHE / 'missing.mkv'
assert not missing.exists()
execute(['cargo', 'build', '--offline', '--locked', '--manifest-path', str(HERE / 'Cargo.toml'),
         '--target-dir', str(TARGET)], 120)
addon = CACHE / 'libmpv-handoff-probe.node'
shutil.copyfile(TARGET / 'debug/libmpv_handoff_probe.dll', addon)
common = [str(addon), binary['dll'], *[sample['path'] for sample in samples], str(missing)]
receipts = {}
for name, executable, main, extra in [
    ('node', shutil.which('node'), 'node.cjs', []),
    ('electron', str(Path(graphics['electron']['runtime']) / 'electron.exe'),
     'electron-main.cjs', [str(CACHE / 'electron-user-data')]),
]:
    output = CACHE / f'{name}.json'
    result = execute([executable, str(HERE / main), *common, str(output), *extra], 50)
    receipt = json.loads(output.read_text(encoding='utf-8'))
    receipt['stdout'] = result.stdout
    receipt['stderr'] = result.stderr
    receipt['executableSha256'] = digest(executable)
    receipts[name] = receipt

sources = ['Cargo.toml', 'Cargo.lock', 'build.rs', 'binding.rs', 'handoff.cpp',
           'scenario.cjs', 'node.cjs', 'electron-main.cjs', 'electron-preload.cjs', 'electron.html', 'run.py', 'verify.py']
record = {
    'checkedAt': datetime.now(timezone.utc).isoformat(),
    'dllSha256': binary['dllSha256'], 'sourceCommit': binary['sourceCommit'],
    'addonSha256': digest(addon),
    'sharedProducerSha256': digest(HERE.parent / 'libmpv-gpu/producer.cpp'),
    'samples': samples,
    'sources': {name: digest(HERE / name) for name in sources},
    'runs': receipts,
    'formalPublicApiImplemented': False,
    'crossPlatformVerified': False,
    'arbitraryScriptSwitchingVerified': False,
    'nativeLowPeakLinearIssueFixed': False,
}
(HERE / 'handoff-contract.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
print(json.dumps({name: [{'created': case['stats']['created'], 'released': case['stats']['released'],
                        'staleNodeDrops': case['staleNodeDrops']} for case in receipt['cases']]
                  for name, receipt in receipts.items()}))
