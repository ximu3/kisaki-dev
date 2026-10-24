"""Verify recorded brightness and gamut conversions independently of presentation."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
hdr = json.loads((HERE / 'hdr-contract.json').read_text())
sdr = json.loads((HERE / 'sdr-contract.json').read_text())
for receipt in [hdr, sdr]:
    for name, expected in receipt['sources'].items():
        assert digest(HERE / name) == expected, name
    for name, expected in receipt['sharedSources'].items():
        assert digest(HERE.parent / name) == expected, name
    assert receipt['before'] == receipt['after'] and receipt['originalStateRestored']
    assert receipt['allReferencesReleasedBeforeWindowClose']
    assert not receipt['stderr']
    assert all(case['releaseCount'] == 1 for case in receipt['cases'])
assert hdr['capabilities']['dynamicRangeHigh']
assert not sdr['capabilities']['dynamicRangeHigh']
cases = {case['name']: case for case in hdr['cases']}
setups = {setup['name']: setup for setup in hdr['setups']}

linear = []
for name in ['linear-relative-418', 'linear-relative-100', 'bt2020-linear-418']:
    case = cases[name]
    unit = setups[name]['nitsPerUnit']
    expected = [sum(pixel[:3]) / 3 * unit / 80 for pixel in case['nativeSamples']]
    actual = case['compositorLinearValues']
    errors = [abs(observed - reference) for observed, reference in zip(actual, expected)]
    assert all(error <= max(0.00005, abs(reference) * 0.02) for error, reference in zip(errors, expected))
    assert all(right > left for left, right in zip(actual, actual[1:]))
    linear.append({'name': name, 'expectedScRgb': expected, 'actualScRgb': actual,
                   'maxAbsoluteError': max(errors),
                   'maxRelativeError': max(error / value for error, value in zip(errors, expected))})

# Derive the D65 primary matrix rather than fitting it to the captured pixels.
def inverse(m):
    a, b, c = m[0]
    d, e, f = m[1]
    g, h, i = m[2]
    det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
    return [[value / det for value in row] for row in
            [[e * i - f * h, c * h - b * i, b * f - c * e],
             [f * g - d * i, a * i - c * g, c * d - a * f],
             [d * h - e * g, b * g - a * h, a * e - b * d]]]


def mv(m, vector):
    return [sum(a * b for a, b in zip(row, vector)) for row in m]


def primaries(points):
    columns = [[x / y, 1, (1 - x - y) / y] for x, y in points]
    matrix = [list(row) for row in zip(*columns)]
    white = [0.3127 / 0.3290, 1, (1 - 0.3127 - 0.3290) / 0.3290]
    scale = mv(inverse(matrix), white)
    return [[value * scale[index] for index, value in enumerate(row)] for row in matrix]


bt2020 = primaries([(0.708, 0.292), (0.170, 0.797), (0.131, 0.046)])
bt709_inverse = inverse(primaries([(0.640, 0.330), (0.300, 0.600), (0.150, 0.060)]))
matrix = [[sum(bt709_inverse[row][k] * bt2020[k][column] for k in range(3))
           for column in range(3)] for row in range(3)]
colors = cases['bt2020-colors-418']
expected = [mv(matrix, [value / 80 for value in pixel]) for pixel in colors['nativeRgbNits']]
actual = [pixel[:3] for pixel in colors['compositor']['samples'][:-1]]
color_error = max(abs(a - b) for aa, bb in zip(actual, expected) for a, b in zip(aa, bb))
assert color_error < 0.01
assert any(value < -0.05 for pixel in actual for value in pixel)

pq = cases['pq-4000']
assert pq['nativeNits'][6] > pq['nativeNits'][5] * 3
assert abs(pq['compositorLinearValues'][6] - pq['compositorLinearValues'][5]) < 0.001
compressed = cases['pq-418']
ratio = compressed['compositorLinearValues'][-1] * 80 / compressed['nativeNits'][-1]
assert ratio < 0.8
result = {'checkedAt': datetime.now(timezone.utc).isoformat(),
          'sourceSha256': digest(Path(__file__)),
          'receipts': {name: digest(HERE / name) for name in ['hdr-contract.json', 'sdr-contract.json']},
          'linearBrightnessChecks': linear,
          'bt2020ToBt709Matrix': matrix, 'gamutExpectedScRgb': expected,
          'gamutActualScRgb': actual, 'gamutMaxAbsoluteError': color_error,
          'wideGamutNegativeChannelsRetained': True,
          'pq4000HighlightStepsCollapsed': True,
          'pq418CompositorToNativePeakRatio': ratio,
          'completeColorPipelineVerified': False, 'physicalHdrDisplayVerified': False}
(HERE / 'analysis.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'linearBrightnessChecks': len(linear), 'gamutMaxAbsoluteError': color_error,
                  'pq418CompositorToNativePeakRatio': ratio, 'sourceHashes': 'pass'}))
