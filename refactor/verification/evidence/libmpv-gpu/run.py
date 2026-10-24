"""Run real rendering in a bounded process with pinned probe inputs."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import shutil
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / "node_modules/.cache/libmpv-design/graphics"
TARGET = ROOT / "node_modules/.cache/libmpv-design/gpu-target"
ADDON = TARGET / "libmpv-gpu-probe.node"
inputs = json.loads((HERE / "binary-input.json").read_text(encoding="utf-8"))
mpv = json.loads((HERE.parent / "libmpv-native/binary-input.json").read_text(encoding="utf-8"))


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def execute(arguments, timeout):
    result = subprocess.run(arguments, cwd=ROOT, capture_output=True, text=True,
                            timeout=timeout, creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:
        raise RuntimeError(f"Graphics probe failed ({result.returncode}).\n{result.stdout}\n{result.stderr}")
    return result


assert digest(mpv['dll']) == mpv['dllSha256']
for name, sha in inputs['angle']['files'].items():
    assert digest(Path(inputs['angle']['directory']) / name) == sha
for sample in [inputs['sample'], inputs['movie'], *inputs['alphaSamples']]:
    assert digest(sample['path']) == sample['sha256']
for header in inputs['directD3d11Headers']['files']:
    assert digest(CACHE/'include/mpv'/header['path']) == header['sha256']
execute(['cargo', 'build', '--offline', '--locked', '--manifest-path', str(HERE/'Cargo.toml'),
         '--target-dir', str(TARGET)], 120)
shutil.copy2(TARGET/'debug/libmpv_gpu_probe.dll', ADDON)
script = CACHE / 'startup.lua'
sample = inputs['sample']['path'].replace('\\', '/')
script.write_text(f"mp.commandv('loadfile', {json.dumps(sample)})\n", encoding='utf-8')
runs = []
diagnostics = []
for backend in ['angle','d3d11']:
    run = execute(['node', str(HERE/'native-probe.mjs'), str(ADDON), mpv['dll'],
                   inputs['angle']['directory'], inputs['sample']['path'], str(script),backend], 35)
    runs.append(json.loads(run.stdout))
    diagnostics.append(run.stderr)
result = {'node': runs[0]['node'], 'runs': runs,
          'cases': [{**case, 'backend': run['backend']} for run in runs for case in run['cases']]}
pressure = execute(['node',str(HERE/'pressure-probe.mjs'),str(ADDON),mpv['dll'],inputs['movie']['path']], 25)
result['framePressure'] = json.loads(pressure.stdout)
diagnostics.append(pressure.stderr)
formats = execute(['node',str(HERE/'format-probe.mjs'),str(ADDON),mpv['dll'],inputs['sample']['path'],
                   *[sample['path'] for sample in inputs['alphaSamples']]],25)
result['formats'] = json.loads(formats.stdout)
diagnostics.append(formats.stderr)
result.update({'checkedAt': datetime.now(timezone.utc).isoformat(), 'dllSha256': mpv['dllSha256'],
               'addonSha256': digest(ADDON), 'nativeGpuExecuted': True,
               'electronImportExecuted': False, 'independentAnglePackagingVerified': False,
               'hardwareDecodingExecuted': False, 'hdrTargetPixelsExecuted': True,
               'hdrSourceToneMappingVerified': False, 'physicalHdrDisplayVerified': False,
               'directD3d11RenderApiExecuted': True, 'nativeSettingsGuardImplemented': False,
               'sources': {name:digest(HERE/name) for name in
                    ['Cargo.toml','Cargo.lock','build.rs','binding.rs','producer.cpp','native-probe.mjs','pressure-probe.mjs','format-probe.mjs','run.py']},
               'stderr': ''.join(diagnostics)})
(HERE/'native-contract.json').write_text(json.dumps(result,indent=2)+'\n', encoding='utf-8')
print(json.dumps({'renderCases':len(result['cases']), 'nativeGpuExecuted':True}))
