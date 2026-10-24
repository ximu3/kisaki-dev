"""Run capture geometry and text mapping proofs in the recorded Electron runtime."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-content'
runtime = json.loads((HERE.parent / 'libmpv-gpu/binary-input.json').read_text(encoding='utf-8'))['electron']['runtime']
env = dict(os.environ)
env.pop('ELECTRON_RUN_AS_NODE', None)
receipts = []
for scale in ['1', '1.5']:
    output = CACHE / f'view-{scale}.json'
    run = subprocess.run([str(Path(runtime) / 'electron.exe'), str(HERE / 'content-electron.cjs'), str(CACHE), str(output), scale],
                         cwd=ROOT, env=env, capture_output=True, text=True, timeout=50,
                         creationflags=subprocess.CREATE_NO_WINDOW)
    if run.returncode:
        raise RuntimeError(f'Capture proof failed for scale {scale}:\n{run.stdout}\n{run.stderr}')
    receipts.append(json.loads(output.read_text(encoding='utf-8')))
result = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'runs': receipts,
          'sources': {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest() for name in
                      ['content-probe.html', 'content-probe.mjs', 'content-electron.cjs', 'run-probe.py']},
          'caseFoldingSha256': hashlib.sha256((CACHE / 'casefold.txt').read_bytes()).hexdigest(),
          'standardSourceAddressRoundTripTested': False, 'fullQuoteProjectionTested': False,
          'productionReaderOrHostAdapterTested': False}
(HERE / 'browser-contract.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(json.dumps({'runs': len(receipts), 'captures': sum(len(r['cases']) for r in receipts), 'mappedSearchCases': receipts[0]['text']['mappedSearchCases']}))
