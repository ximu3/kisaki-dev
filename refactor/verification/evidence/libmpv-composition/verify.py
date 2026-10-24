"""Check every converted pixel and distinguish video, ASS subtitles, and OSD."""
from pathlib import Path
import hashlib
import json
import math
import struct
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
digest = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
data = json.loads((HERE / 'native-contract.json').read_text())
for name, expected in data['sources'].items():
    assert digest(HERE / name) == expected
for name, expected in data['sharedSources'].items():
    assert digest(HERE.parent / name) == expected
assert digest(HERE.parent / 'libmpv-tonemapping/hdr-contract.json') == data['fixtureReceiptSha256']
for reference in [*data['inputFiles'].values(), data['subtitles'], data['negativeControlShader']]:
    assert digest(reference['path']) == reference['sha256']
binary = json.loads((HERE.parent / 'libmpv-native/binary-input.json').read_text())
assert digest(binary['dll']) == data['dllSha256']
assert digest(ROOT / 'node_modules/.cache/libmpv-design/gpu-target/libmpv-gpu-probe.node') == data['addonSha256']
assert digest(ROOT / 'node_modules/.cache/libmpv-design/composition-target/debug/libmpv-composition-probe.exe') == data['helperSha256']
assert data['allReturnedFramesReleased'] and not data['displaySettingsChanged']


def load(reference, sample, allow_non_finite=False):
    assert digest(reference['path']) == reference['sha256']
    raw = Path(reference['path']).read_bytes()
    count = sample['width'] * sample['height'] * 4
    assert len(raw) == count * 2
    values = struct.unpack(f'<{count}e', raw)
    assert allow_non_finite or all(math.isfinite(value) for value in values)
    assert all(value == 1 for value in values[3::4])
    return values, struct.unpack(f'<{count}H', raw)


def f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


def half_order(bits):
    return 0x8000 - (bits & 0x7fff) if bits & 0x8000 else 0x8000 + bits


cases = {case['name']: case for case in data['cases']}
assert len(cases) == 8
raw = {}
checks = []
source_failures = []
components_checked = 0
for name, case in cases.items():
    assert case['observations']['subtitleSelected'] == case['subtitle']
    assert case['observations']['osdConfigured'] == case['osd']
    assert case['observations']['blendSubtitles'] == 'no'
    assert [(sample['width'], sample['height']) for sample in case['samples']] == [(63, 47), (31, 23)]
    raw[name] = []
    for index, sample in enumerate(case['samples']):
        known_failure = name == 'both-low-peak'
        source, source_bits = load(sample['raw'], sample, known_failure)
        non_finite = [i for i, value in enumerate(source) if not math.isfinite(value)]
        assert bool(non_finite) == known_failure
        if non_finite:
            source_failures.append({'case': name, 'frame': index, 'nonFiniteComponents': len(non_finite),
                                    'nonFinitePixels': len({i // 4 for i in non_finite})})
        raw[name].append(source)
        assert len(sample['conversions']) == (0 if case.get('hook') else 2)
        if name in ['srgb-linear', 'p3-linear']:
            assert min(source) < -0.02
        for conversion in sample['conversions']:
            before, before_bits = load(conversion['input'], sample, known_failure)
            actual, actual_bits = load(conversion['output'], sample, known_failure)
            assert before_bits == source_bits
            factor = f32(case['nativeNitsPerUnit'] / conversion['nitsPerUnit'])
            assert f32(conversion['factor']) == factor
            maximum_ulp = 0
            maximum_absolute = 0
            for i, value in enumerate(source):
                if i % 4 == 3:
                    assert actual_bits[i] == source_bits[i]
                    continue
                if not math.isfinite(value):
                    assert not math.isfinite(actual[i])
                    continue
                expected = f32(value * factor)
                expected_bits = struct.unpack('<H', struct.pack('<e', expected))[0]
                distance = abs(half_order(expected_bits) - half_order(actual_bits[i]))
                maximum_ulp = max(maximum_ulp, distance)
                maximum_absolute = max(maximum_absolute, abs(actual[i] - expected))
                components_checked += 1
            assert maximum_ulp <= 1
            checks.append({'case': name, 'frame': index, 'nitsPerUnit': conversion['nitsPerUnit'],
                           'maximumHalfUlpError': maximum_ulp, 'maximumAbsoluteError': maximum_absolute,
                           'sourceNonFiniteComponents': len(non_finite),
                           'minimumComponent': min(value for value in actual if math.isfinite(value)),
                           'maximumComponent': max(value for value in actual if math.isfinite(value))})


def pixel_error(left, right, pixel, factor=1):
    return max(abs(left[pixel * 4 + channel] - right[pixel * 4 + channel] * factor)
               for channel in range(3))


layer_checks = []
for index, sample in enumerate(cases['base']['samples']):
    base = raw['base'][index]
    subtitles = raw['subtitles'][index]
    osd = raw['osd'][index]
    both = raw['both'][index]
    hook = raw['output-hook'][index]
    count = sample['width'] * sample['height']
    subtitle_mask = {pixel for pixel in range(count) if pixel_error(subtitles, base, pixel) > 0.01}
    osd_mask = {pixel for pixel in range(count) if pixel_error(osd, base, pixel) > 0.01}
    assert len(subtitle_mask) >= 8 and len(osd_mask) >= 8
    assert not subtitle_mask & osd_mask
    assert max(pixel_error(both, subtitles, pixel) for pixel in subtitle_mask) < 0.002
    assert max(pixel_error(both, osd, pixel) for pixel in osd_mask) < 0.002
    # Isolate video from low-contrast overlay edges that may resemble the background.
    video_mask = {pixel for pixel in range(count)
                  if 0.36 <= (pixel // sample['width'] + 0.5) / sample['height'] <= 0.46
                  and pixel_error(subtitles, base, pixel) == 0
                  and pixel_error(osd, base, pixel) == 0
                  and pixel_error(both, base, pixel) == 0
                  and max(base[pixel * 4:pixel * 4 + 3]) > 0.05}
    assert len(video_mask) > 8
    assert max(pixel_error(hook, base, pixel, 0.5) for pixel in video_mask) < 0.002
    missed_subtitles = sum(pixel_error(hook, both, pixel, 0.5) > 0.03 for pixel in subtitle_mask)
    missed_osd = sum(pixel_error(hook, both, pixel, 0.5) > 0.03 for pixel in osd_mask)
    assert missed_subtitles >= 8 and missed_osd >= 8
    low_peak = raw['both-low-peak'][index]
    assert sum(low_peak[pixel * 4 + 1] > low_peak[pixel * 4] + 0.05 for pixel in subtitle_mask) >= 4
    assert sum(low_peak[pixel * 4] > low_peak[pixel * 4 + 1] + 0.05 for pixel in osd_mask) >= 4
    layer_checks.append({'frame': index, 'subtitleChangedPixels': len(subtitle_mask),
                         'osdChangedPixels': len(osd_mask), 'videoControlPixels': len(video_mask),
                         'outputHookMissedSubtitlePixels': missed_subtitles,
                         'outputHookMissedOsdPixels': missed_osd})

assert len(checks) == 28
assert any(check['maximumComponent'] > 5 for check in checks)
assert any(check['minimumComponent'] < -0.05 for check in checks)
diagnostics = json.loads((HERE / 'black-contract.json').read_text())
assert digest(HERE / 'diagnose.cjs') == diagnostics['scriptSha256']
assert digest(HERE / 'native-contract.json') == diagnostics['compositionReceiptSha256']
assert digest(diagnostics['source']['path']) == diagnostics['source']['sha256']
assert digest(diagnostics['generator']['path']) == diagnostics['generator']['sha256']
description = subprocess.run(['ffprobe', '-v', 'error', '-read_intervals', '%+#1',
    '-select_streams', 'v:0', '-show_frames', '-of', 'json', diagnostics['source']['path']],
    capture_output=True, text=True, check=True, timeout=10, creationflags=subprocess.CREATE_NO_WINDOW)
source_frame = json.loads(description.stdout)['frames'][0]
assert source_frame['color_transfer'] == 'smpte2084' and source_frame['color_primaries'] == 'bt2020'
assert source_frame['pix_fmt'] == 'yuv420p10le' and source_frame['color_range'] == 'tv'
metadata = [item for item in source_frame['side_data_list'] if item['side_data_type'] in
            ['Mastering display metadata', 'Content light level metadata']]
assert len(metadata) == 2
assert next(item for item in metadata if item['side_data_type'] == 'Content light level metadata')['max_content'] == 4000
assert digest(diagnostics['sdrSource']['path']) == diagnostics['sdrSource']['sha256']
sdr_description = subprocess.run(['ffprobe', '-v', 'error', '-read_intervals', '%+#1',
    '-select_streams', 'v:0', '-show_frames', '-of', 'json', diagnostics['sdrSource']['path']],
    capture_output=True, text=True, check=True, timeout=10, creationflags=subprocess.CREATE_NO_WINDOW)
sdr_frame = json.loads(sdr_description.stdout)['frames'][0]
assert sdr_frame['color_transfer'] == 'bt709' and sdr_frame['color_primaries'] == 'bt709'
assert sdr_frame['pix_fmt'] == 'yuv420p' and sdr_frame['color_range'] == 'tv'
assert not any(item['side_data_type'] in ['Mastering display metadata', 'Content light level metadata']
               for item in sdr_frame.get('side_data_list', []))
diagnostic_checks = []
assert len(diagnostics['cases']) == 23
for case in diagnostics['cases']:
    expected_failure = (case['kind'] in ['subtitles', 'sdr-subtitles'] and case['transfer'] == 'linear'
                        and case['peakNits'] < 203 and case['toneMapping'] in ['auto', 'hable'])
    if case['kind'] == 'sdr-subtitles':
        assert case['observations']['sourcePrimaries'] == 'bt.709'
        assert case['observations']['sourceTransfer'] not in ['pq', 'hlg']
    if case['kind'] in ['subtitles', 'sdr-subtitles']:
        assert case['observations']['targetPrim'] == case['primaries']
    counts = []
    for sample in case['samples']:
        values, _ = load(sample['raw'], sample, True)
        count = sum(not math.isfinite(value) for value in values)
        assert count == sample['nonFinite'] and bool(count) == expected_failure
        counts.append(count)
    diagnostic_checks.append({'kind': case['kind'], 'primaries': case['primaries'], 'transfer': case['transfer'],
        'peakNits': case['peakNits'], 'toneMapping': case['toneMapping'],
        'nonFiniteComponentsBySize': counts})
result = {
    'sourceSha256': digest(HERE / 'native-contract.json'), 'verifierSha256': digest(__file__),
    'conversions': len(checks), 'rgbComponentsChecked': components_checked,
    'maximumHalfUlpError': max(check['maximumHalfUlpError'] for check in checks),
    'checks': checks, 'layers': layer_checks, 'sourceFailures': source_failures,
    'diagnosticReceiptSha256': digest(HERE / 'black-contract.json'),
    'blackSourceMetadata': metadata, 'diagnostics': diagnostic_checks,
    'sdrSource': {key: sdr_frame[key] for key in ['pix_fmt', 'color_range', 'color_primaries', 'color_transfer']},
    'sdrSourceReproducesLinearSubtitleFailure': True,
    'wholeFrameGpuUnitConversionVerifiedForFiniteInputs': True,
    'staticAssAndOsdIncluded': True, 'outputHookNegativeControlVerified': True,
    'normalPlaybackValidationPassed': False,
    'completeColorPipelineVerified': False, 'hostDisplayVerified': False,
    'animatedAssVerified': False, 'productionOutputImplemented': False
}
(HERE / 'analysis.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: value for key, value in result.items() if key != 'checks'}))
