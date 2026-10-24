"""Verify native linear representations against independently derived primary matrices."""
from fractions import Fraction
from pathlib import Path
import hashlib
import json
import math

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
data = json.loads((HERE / 'native-contract.json').read_text())
assert digest(HERE / 'run.cjs') == data['scriptSha256']
assert digest(HERE.parent / 'libmpv-tonemapping/hdr-contract.json') == data['fixtureReceiptSha256']
for name, expected in data['sharedSources'].items():
    assert digest(HERE.parent / name) == expected
for source in data['sources'].values():
    assert digest(source['path']) == source['sha256']
binary = json.loads((HERE.parent / 'libmpv-native/binary-input.json').read_text())
assert digest(binary['dll']) == data['dllSha256']
assert digest(ROOT / 'node_modules/.cache/libmpv-design/gpu-target/libmpv-gpu-probe.node') == data['addonSha256']


def multiply(left, right):
    return [[sum(left[row][k] * right[k][col] for k in range(3))
             for col in range(len(right[0]))] for row in range(3)]


def inverse(matrix):
    rows = [list(row) + [Fraction(int(i == j)) for j in range(3)]
            for i, row in enumerate(matrix)]
    for col in range(3):
        pivot = next(row for row in range(col, 3) if rows[row][col])
        rows[col], rows[pivot] = rows[pivot], rows[col]
        scale = rows[col][col]
        rows[col] = [value / scale for value in rows[col]]
        for row in range(3):
            if row != col:
                factor = rows[row][col]
                rows[row] = [value - factor * pivot_value
                             for value, pivot_value in zip(rows[row], rows[col])]
    return [row[3:] for row in rows]


def xyz(point):
    x, y = map(Fraction, point)
    return [x / y, Fraction(1), (1 - x - y) / y]


def rgb_to_xyz(points):
    basis = list(map(list, zip(*(xyz(point) for point in points))))
    scales = multiply(inverse(basis), [[value] for value in xyz(('0.3127', '0.3290'))])
    return [[basis[row][col] * scales[col][0] for col in range(3)] for row in range(3)]


primaries = {
    'bt.709': [('0.64', '0.33'), ('0.30', '0.60'), ('0.15', '0.06')],
    'display-p3': [('0.68', '0.32'), ('0.265', '0.69'), ('0.15', '0.06')],
    'bt.2020': [('0.708', '0.292'), ('0.170', '0.797'), ('0.131', '0.046')]
}
matrices = {name: rgb_to_xyz(points) for name, points in primaries.items()}
cases = {(case['primaries'], case['kind'], case['gamut']): case for case in data['cases']}
assert len(cases) == 9
for case in cases.values():
    assert [(sample['width'], sample['height']) for sample in case['samples']] == [(63, 47), (31, 23)]
    assert all(len(sample['pixels']) == 7 and all(len(pixel) == 4 for pixel in sample['pixels'])
               for sample in case['samples'])
assert data['allReturnedFramesReleased'] and not data['angleLoaded']
assert not data['ownShaderUsed'] and not data['displaySettingsChanged']
baseline = cases[('bt.2020', 'colors', 'clip')]
steps_baseline = cases[('bt.2020', 'steps', 'clip')]
tolerance = 0.002
checks = []
for name, matrix in matrices.items():
    conversion = multiply(inverse(matrix), matrices['bt.2020'])
    error = auto_error = neutral_error = 0
    minimum = math.inf
    maximum_neutral = 0
    for sample, auto, source, steps, steps_source in zip(
        cases[(name, 'colors', 'clip')]['samples'],
        cases[(name, 'colors', 'auto')]['samples'],
        baseline['samples'], cases[(name, 'steps', 'clip')]['samples'], steps_baseline['samples'],
        strict=True
    ):
        assert (sample['width'], sample['height']) == (source['width'], source['height'])
        for actual, automatic, original in zip(sample['pixels'], auto['pixels'], source['pixels'], strict=True):
            expected = [sum(float(row[k]) * original[k] for k in range(3)) for row in conversion]
            error = max(error, *(abs(actual[k] - expected[k]) for k in range(3)))
            auto_error = max(auto_error, *(abs(automatic[k] - expected[k]) for k in range(3)))
            minimum = min(minimum, *actual[:3])
            assert all(math.isfinite(value) for value in actual) and actual[3] == 1
        for pixel, expected in zip(steps['pixels'], steps_source['pixels'], strict=True):
            neutral_error = max(neutral_error, *(abs(pixel[k] - expected[k]) for k in range(3)))
            assert all(math.isfinite(value) for value in pixel) and pixel[3] == 1
        levels = [sum(pixel[:3]) / 3 for pixel in steps['pixels']]
        assert all(after > before for before, after in zip(levels, levels[1:]))
        assert levels[-1] > 2
        maximum_neutral = max(maximum_neutral, levels[-1])
    assert error < tolerance and neutral_error < tolerance
    if name != 'bt.2020':
        assert minimum < -0.02 and auto_error > 0.1
    checks.append({
        'primaries': name, 'matrix': [[float(value) for value in row] for row in conversion],
        'maximumComponentError': error, 'defaultMappingMaximumError': auto_error,
        'minimumComponent': minimum, 'maximumNeutralError': neutral_error,
        'maximumNeutralValue': maximum_neutral
    })

result = {
    'sourceSha256': digest(HERE / 'native-contract.json'),
    'verifierSha256': digest(__file__), 'absoluteTolerance': tolerance, 'checks': checks,
    'linearRepresentationsVerified': True, 'negativeComponentsVerified': True,
    'extendedLuminanceVerified': True, 'completeColorPipelineVerified': False,
    'hostImportVerified': False, 'subtitleVerified': False
}
(HERE / 'analysis.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
