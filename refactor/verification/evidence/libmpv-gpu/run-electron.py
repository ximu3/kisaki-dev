"""Verify shared-texture import in the selected Electron consumer runtime."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/libmpv-design/graphics'
ADDON = ROOT / 'node_modules/.cache/libmpv-design/gpu-target/libmpv-gpu-probe.node'
inputs = json.loads((HERE/'binary-input.json').read_text(encoding='utf-8'))
native = json.loads((HERE/'native-contract.json').read_text(encoding='utf-8'))
mpv = json.loads((HERE.parent/'libmpv-native/binary-input.json').read_text(encoding='utf-8'))
assert hashlib.sha256(ADDON.read_bytes()).hexdigest() == native['addonSha256']
output = HERE/'electron-contract.json'
environment = dict(os.environ)
environment.pop('ELECTRON_RUN_AS_NODE', None)
result = subprocess.run([
    str(Path(inputs['electron']['runtime'])/'electron.exe'), str(HERE/'electron-main.cjs'),
    str(ADDON), mpv['dll'], inputs['angle']['directory'], inputs['sample']['path'],
    str(CACHE/'startup.lua'), str(output), str(CACHE/'electron-user-data')
], cwd=ROOT, env=environment, capture_output=True, text=True, timeout=35,
    creationflags=subprocess.CREATE_NO_WINDOW)
if result.returncode:
    raise RuntimeError(f'Electron probe failed ({result.returncode}).\n{result.stdout}\n{result.stderr}')
receipt = json.loads(output.read_text(encoding='utf-8'))
receipt.update({'checkedAt': datetime.now(timezone.utc).isoformat(),
                'addonSha256': native['addonSha256'], 'dllSha256': mpv['dllSha256'],
                'directD3d11RenderApiExecuted': True,
                'nativeSettingsGuardImplemented': False,
                'sources': {name:hashlib.sha256((HERE/name).read_bytes()).hexdigest() for name in
                            ['electron-main.cjs','electron-preload.cjs','electron.html','run-electron.py']},
                'stdout': result.stdout, 'stderr': result.stderr})
output.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'electron':receipt['electron'],'imports':len(receipt['imports']),
                  'electronImportExecuted':receipt['electronImportExecuted']}))
