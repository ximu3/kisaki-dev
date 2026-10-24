"""Bound the renderer experiment and preserve its actual failure or success."""
from pathlib import Path
import hashlib
import json
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
result = subprocess.run(['node',str(HERE/'probe.mjs')],cwd=ROOT,capture_output=True,
                        text=True,timeout=45,creationflags=subprocess.CREATE_NO_WINDOW)
if result.returncode:
    raise RuntimeError(f'Renderer comparison failed ({result.returncode}).\n{result.stdout}\n{result.stderr}')
receipt = json.loads((HERE/'native-contract.json').read_text(encoding='utf-8'))
receipt['stderr'] = result.stderr
receipt['runnerSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
(HERE/'native-contract.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(result.stdout,end='')
