"""Temporarily test the explicitly authorized G24H2 HDR state and restore it."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import importlib.util
import json
import subprocess
import sys
import time

sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/libmpv-design/display'
CACHE.mkdir(parents=True, exist_ok=True)
source = HERE.parent / 'libmpv-playback/display-check.py'
spec = importlib.util.spec_from_file_location('display_check', source)
display = importlib.util.module_from_spec(spec)
spec.loader.exec_module(display)
name = 'G24H2'
assert sys.argv[1:] == ['--hdr-test', name]
before = [record for record, _ in display.displays()]
original, _ = display.selected(name)
assert not original['advancedColorEnabled'], 'This comparison requires an SDR baseline.'
checkpoint = CACHE / 'hdr-restore-state.json'
state = {'display': name, 'originalEnabled': original['advancedColorEnabled'],
         'before': before, 'restorePending': True}
checkpoint.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
active = None
failure = None
try:
    for hdr in [False, True]:
        if hdr:
            active = display.set_enabled(name, True)
            time.sleep(1)
        result = subprocess.run([sys.executable, str(HERE / 'run.py')], cwd=ROOT,
            capture_output=True, text=True, timeout=45, creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode:
            raise RuntimeError(f'Display comparison failed ({result.returncode}).\n{result.stderr}')
        receipt = json.loads((CACHE / 'last-run.json').read_text(encoding='utf-8'))
        assert receipt['display']['label'] == name
        assert receipt['capabilities']['dynamicRangeHigh'] == hdr
        samples = receipt['cases'][1]['video']['compositor']['samples']
        ratio = sum(samples[3][:3]) / sum(samples[4][:3])
        if hdr:
            assert ratio > 1.05, 'The HDR reference did not exceed the CSS white reference.'
        else:
            assert abs(ratio - 1) < 0.02, 'The SDR reference did not match the CSS white reference.'
        receipt['compositedHdrHeadroomVerified'] = hdr
        receipt['highlightToCssWhiteRatio'] = ratio
        reference = receipt['cases'][0]['video']['compositor']['samples']
        receipt['highlightToReferenceWhiteRatio'] = sum(samples[3][:3]) / sum(reference[3][:3])
        for index in range(3):
            assert reference[index][index] > 0.4
            assert all(abs(reference[index][channel]) < reference[index][index] * 0.02
                       for channel in range(3) if channel != index)
        (HERE / ('hdr-contract.json' if hdr else 'sdr-contract.json')).write_text(
            json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
except Exception as error:
    failure = error
finally:
    restored = display.set_enabled(name, original['advancedColorEnabled'])
    state['restorePending'] = False
    state['restored'] = restored
    checkpoint.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
after = [record for record, _ in display.displays()]
assert after == before, 'The original display configuration was not restored.'
receipt = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'before': before,
           'active': active, 'after': after, 'originalStateRestored': True,
           'sources': {str(path.relative_to(HERE.parent)): hashlib.sha256(path.read_bytes()).hexdigest()
                       for path in [source, Path(__file__)]},
           'receipts': {name: hashlib.sha256((HERE / name).read_bytes()).hexdigest()
                        for name in ['sdr-contract.json', 'hdr-contract.json']} if failure is None else {}}
(HERE / 'displays.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
if failure:
    raise failure
for name in ['sdr-contract.json', 'hdr-contract.json']:
    result = json.loads((HERE / name).read_text(encoding='utf-8'))
    print(json.dumps({'run': name, 'capabilities': result['capabilities'],
        'cases': [{'input': case['input'], 'compositor': case['video']['compositor'],
                   'releaseCount': case['releaseCount']} for case in result['cases']]}))
print(json.dumps({'originalStateRestored': True, 'after': after}))
