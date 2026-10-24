"""Independently check recorded pixels, identities, lifetimes, and source digests."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
record = json.loads((HERE / 'handoff-contract.json').read_text(encoding='utf-8'))


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def color(pixel, expected):
    assert len(pixel) == 4 and pixel[3] == 255
    index = 0 if expected == 'red' else 2
    assert pixel[index] > 220 and pixel[1] < 35 and pixel[2 - index] < 35


for name, expected in record['sources'].items():
    assert digest(HERE / name) == expected, name
assert digest(HERE.parent / 'libmpv-gpu/producer.cpp') == record['sharedProducerSha256']
binary = json.loads((HERE.parent / 'libmpv-native/binary-input.json').read_text(encoding='utf-8'))
assert record['dllSha256'] == binary['dllSha256'] == digest(binary['dll'])
assert digest(ROOT / 'node_modules/.cache/libmpv-design/handoff/libmpv-handoff-probe.node') == record['addonSha256']
for sample in record['samples']:
    assert digest(sample['path']) == sample['sha256']
metrics = []
for runtime, run in record['runs'].items():
    assert len(run['cases']) == 2
    assert [case['renderFirst'] for case in run['cases']] == [False, True]
    for case in run['cases']:
        assert case['realNodeCallbacks'] and case['independentNativeHookClient']
        assert case['independentNativeObservationClient'] and case['independentNativeRenderThread']
        assert case['distinctThreadsafeCallbackChannels'] == 3
        assert not case['framePixelsUsedForAdmission']
        assert not case['sourceFileIdentityAttachedToNativeFrame']
        assert not case['reusedBackingTexturePoolVerified']
        stats = case['stats']
        assert stats['created'] == stats['released'] >= 8
        assert stats['live'] == 0 and stats['maxLive'] <= 4
        assert stats['nativeClosed'] and stats['hookCount'] == 5
        assert case['closeStats']['nativeClosed'] and case['closeStats']['live'] >= 1
        assert case['staleNodeDrops'] >= 1 and case['naiveRelabelMismatches'] == 1
        assert abs(case['position'] - 0.5) < 0.02
        assert [s['color'] for s in case['stages']] == ['red', 'blue', 'red', 'missing', 'blue']
        assert len({s['entry'] for s in case['stages']}) == 5
        stages = {s['token']: s for s in case['stages']}
        for stage in stages.values():
            assert stage['commandError'] == 0
            if stage['color'] == 'missing':
                assert stage['failure'] < 0 and not stage['ready'] and stage['consumed'] == 0
            else:
                assert stage['loaded'] and stage['restarted'] and stage['ready']
                assert stage['consumed'] >= 1
        accepted = 0
        stale = 0
        for item in case['deliveries']:
            if item['accepted']:
                accepted += 1
                color(item['sample'], stages[item['token']]['color'])
            else:
                stale += 1
                assert item['delayed'] and item['token'] == 1
                color(item['sample'], 'red')
                if runtime == 'electron':
                    assert item['consumerStateBefore'] == item['consumerStateAfter']
        assert stale == 1 and accepted >= 4
        assert len(case['lateNodeOracle']) == 1
        negative = case['lateNodeOracle'][0]
        assert negative['token'] == 1 and negative['currentToken'] == 2
        assert negative['currentColor'] == 'blue' and not negative['admitted']
        color(negative['sample'], 'red')
        color(case['heldFrameAfterCoreClose']['sample'], 'red')
        assert case['heldFrameAfterCoreClose']['afterCoreClose']
        if runtime == 'electron':
            held = case['heldFrameAfterCoreClose']
            assert held['imports'] == len(case['deliveries'])
            assert len(held['allReferencesReleased']) == held['imports']
            assert all(item['count'] == 1 for item in held['allReferencesReleased'])
            assert run['sandboxedRenderer'] and not run['visibleWindowCreated']
            assert not run['systemDisplaySettingsChanged']
        metrics.append({'runtime': runtime, 'renderPollingMs': case['pollingMilliseconds']['render'],
                        'created': stats['created'], 'released': stats['released'],
                        'maxLive': stats['maxLive'], 'acceptedDeliveries': accepted,
                        'staleConsumerDrops': stale, 'staleNodeDrops': case['staleNodeDrops']})
result = {'verified': True, 'cases': metrics,
          'controlledHandoffVerified': True, 'crossPlatformVerified': False,
          'formalPublicApiImplemented': False, 'nativeLowPeakLinearIssueFixed': False,
          'recordSha256': digest(HERE / 'handoff-contract.json'),
          'verifierSha256': digest(__file__)}
(HERE / 'analysis.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result))
