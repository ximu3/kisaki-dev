"""Compare recorded pixels with independent SDR and source-PQ references."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json

HERE = Path(__file__).resolve().parent
h = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
inputs = json.loads((HERE/'source-input.json').read_text(encoding='utf-8'))
receipt = json.loads((HERE/'screenshot-contract.json').read_text(encoding='utf-8'))
assert h(HERE/'source-input.json') == receipt['sourceReceiptSha256']
for name, digest in receipt['sources'].items():
    assert h(HERE/name) == digest
cases = {row['name']:row for row in receipt['cases']}

def error(actual, expected):
    return max(abs(a-b) for pixel, reference in zip(actual, expected) for a,b in zip(pixel[:3], reference[:3]))

comparisons = {}
for name, row in cases.items():
    assert row['independentBytesAfterCoreAndFrameRelease']
    observed = row['observed']
    assert observed['transfer'] == 'srgb' and observed['peak'] == 'auto'
    assert observed['primaries'] == ('display-p3' if name == 'p3' else 'bt.709')
    assert observed['softwareScreenshot'] == (name == 'hdr-software')
    frame = row['frame']['samples']
    screenshot = row['screenshot']['samples']
    assert all(pixel[3] == 255 for pixel in [*frame, *screenshot])
    difference = error(screenshot, frame)
    comparisons[name] = {'screenshotToFrameMaxError':difference}
    if name != 'hdr-software':
        assert difference <= 2
    if name in ['srgb', 'p3']:
        expected = inputs['p3Expected'] if name == 'p3' else inputs['sourceColors']
        independent = error(screenshot, expected)
        assert independent <= 2
        comparisons[name]['independentReferenceMaxError'] = independent
        assert (row['screenshot']['width'], row['screenshot']['height'], row['screenshot']['stride']) == (63, 47, 256)
    else:
        assert observed['sourceTransfer'] == 'pq' and observed['sourcePrimaries'] == 'bt.2020'
        assert observed['sourceFormat'] == 'yuv420p10' and observed['subtitle'] == 1
        assert (row['screenshot']['width'], row['screenshot']['height']) == (224, 64)
        assert (row['frame']['width'], row['frame']['height']) == (63, 47)
        if name == 'hdr-srgb':
            shades = screenshot[:7]
            assert all(max(pixel[:3])-min(pixel[:3]) <= 2 for pixel in shades)
            assert all(a[0] < b[0] for a,b in zip(shades, shades[1:]))
            assert error([screenshot[-1]], [[255, 0, 0]]) <= 3

def pq(nits):
    power = (nits/10000)**(2610/16384)
    return ((3424/4096+(2413/128)*power)/(1+(2392/128)*power))**(2523/32)

# The owned input was quantized to limited-range ten-bit PQ before encoding.
source_codes = [round(64+876*pq(nits)) for nits in inputs['hdrRequestedNits']]
pq_bytes = [round((code-64)/876*255) for code in source_codes]
software = cases['hdr-software']['screenshot']['samples'][:7]
pq_error = error(software, [[value]*3 for value in pq_bytes])
assert pq_error <= 1
assert comparisons['hdr-software']['screenshotToFrameMaxError'] > 20
assert error(cases['hdr-software']['frame']['samples'], cases['hdr-srgb']['frame']['samples']) <= 2
result = {'checkedAt':datetime.now(timezone.utc).isoformat(), 'comparisons':comparisons,
          'sourcePqBytes':pq_bytes, 'softwareToSourcePqMaxError':pq_error,
          'softwareScreenshotMatchesManagedSdr':False,
          'screenshotReceiptSha256':h(HERE/'screenshot-contract.json'), 'verifySha256':h(__file__)}
(HERE/'verification.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
print(json.dumps(result))
