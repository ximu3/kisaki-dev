"""Observe GPU and software screenshots from four bounded, owned scenes."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess

HERE = Path(__file__).resolve().parent
h = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
inputs = json.loads((HERE/'source-input.json').read_text(encoding='utf-8'))
assert h(inputs['addon']) == inputs['addonSha256']
assert h(inputs['dll']['path']) == inputs['dll']['sha256']
for path, digest in inputs['files'].items():
    assert h(path) == digest
results = []
for scene in inputs['cases']:
    process = subprocess.run(['node', str(HERE/'probe.mjs'), scene['name']], capture_output=True,
                             text=True, timeout=35, creationflags=subprocess.CREATE_NO_WINDOW)
    assert process.returncode == 0, (scene['name'], process.returncode, process.stdout, process.stderr)
    result = json.loads(Path(scene['output']).read_text(encoding='utf-8'))
    results.append({'name':scene['name'], **result, 'stderr':process.stderr})
receipt = {'checkedAt':datetime.now(timezone.utc).isoformat(), 'cases':results,
           'sourceReceiptSha256':h(HERE/'source-input.json'),
           'sources':{name:h(HERE/name) for name in ['prepare.py', 'probe.mjs', 'run.py', 'producer.patch']},
           'publicMpvBindingImplemented':False, 'negativeStrideExecuted':False,
           'electronImportExecuted':False, 'physicalDisplayVerified':False,
           'macosExecuted':False, 'linuxExecuted':False}
(HERE/'screenshot-contract.json').write_text(json.dumps(receipt, indent=2)+'\n', encoding='utf-8')
print(json.dumps([{'name':row['name'], 'frame':row['frame']['samples'], 'screenshot':row['screenshot']}
                  for row in results]))
