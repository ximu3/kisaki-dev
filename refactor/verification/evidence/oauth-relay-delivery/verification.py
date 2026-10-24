"""Check saved delivery evidence and its inputs without running services."""
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlsplit
import hashlib
import json

HERE = Path(__file__).resolve().parent
h = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
read = lambda name: json.loads((HERE/name).read_text(encoding='utf-8'))
inputs = read('source-input.json')
compose = read('compose-contract.json')
lifecycle = read('lifecycle-contract.json')
initial = read('initial-observations.json')
work = Path(inputs['work'])

assert inputs['prepareSha256'] == h(HERE/'prepare.py')
assert inputs['protocolInputSha256'] == h(HERE.parent/'oauth-relay-protocol/source-input.json')
assert h(inputs['compose']['path']) == inputs['compose']['archive']['sha256']
node_archive = work/Path(urlsplit(inputs['node']['archive']['url']).path).name
assert h(node_archive) == inputs['node']['archive']['sha256']
assert h(inputs['node']['path']) == inputs['node']['exeSha256']
for package in inputs['packages']:
    assert h(package['entry']) == package['entrySha256']
    assert h(Path(package['entry']).parent.parent/'package.json') == package['packageSha256']

base = inputs['baseImage']
assert h(base['path']) == base['index']['sha256']
assert base['reference'] == base['tag']+'@sha256:'+base['index']['sha256']
index = json.loads(Path(base['path']).read_text(encoding='utf-8'))
assert [row['platform']['architecture'] for row in base['platforms']] == ['amd64', 'arm64']
for platform in base['platforms']:
    assert platform['platform']['os'] == 'linux'
    assert h(platform['path']) == platform['source']['sha256']
    assert platform['digest'] == 'sha256:'+platform['source']['sha256']
    assert any(row['digest'] == platform['digest'] and row['platform'] == platform['platform']
               for row in index['manifests'])

for receipt in [compose, lifecycle]:
    assert receipt['sourceReceiptSha256'] == h(HERE/'source-input.json')
for filename, digest in compose['sources'].items():
    assert h(HERE/filename) == digest
assert compose['composeVersion'] == inputs['compose']['version'].removeprefix('v')
assert compose['literalRuntimeValuesPreserved'] and compose['renderedDollarEscapingAccountedFor']
assert compose['defaultParserChangedFields'] == ['EXAMPLE_BANGUMI_SECRET', 'EXAMPLE_ANILIST_SECRET']
assert compose['serviceCount'] == 1 and compose['imageIsOwnedPlaceholder']
assert compose['configurationMountReadOnly'] and compose['configurationMountDoesNotCreateHostPath']
assert compose['hostLoopbackBinding'] and compose['stopGracePeriod'] == '30s'
assert compose['diagnostics'] == '' and compose['controlDiagnostics'] == ''

assert lifecycle['scriptSha256'] == h(HERE/'lifecycle.mjs')
assert [case['mode'] for case in lifecycle['cases']] == ['drain', 'deadline']
for case in lifecycle['cases']:
    deadline = case['mode'] == 'deadline'
    assert case['node'] == inputs['node']['version']
    assert case['type'] == 'closed' and case['listenerClosed']
    assert case['activeRequests'] == 0 and case['activeTasks'] == 0
    assert case['cleanupNotifications'] == 1
    assert case['processExit'] == {'code':0, 'signal':None} and case['stderr'] == ''
    assert case['forced'] == deadline and case['upstreamAborted'] == deadline
    if deadline:
        assert case['requestResult'].get('connectionClosed') or case['requestResult'].get('status') == 503
    else:
        assert case['requestResult'] == {'status':200, 'body':{'complete':True}}
assert h(initial['lifecycle']['source']) == initial['lifecycle']['sha256']
assert initial['lifecycle']['forcedObserved'] and not initial['lifecycle']['forcedExpected']
assert initial['compose']['observedDollarEscaping']

for receipt, keys in [
    (inputs, ['dockerEngineUsed', 'baseImageLayersDownloaded', 'systemInstallationChanged', 'realCredentialsUsed']),
    (compose, ['dockerEngineUsed', 'containerStarted', 'imageBuilt', 'realCredentialsUsed', 'composeConfigExpandedIntoPublicEvidence']),
    (lifecycle, ['nativePosixSignalExecuted', 'dockerStopExecuted', 'actualProviderRequests', 'productionRelayImplemented']),
    (initial, ['realCredentialsUsed'])
]:
    assert all(receipt[key] is False for key in keys)

# These files were read while diagnosing the recorded initial assertions.
supporting_sources = []
for filename, url in [
    ('compose-command.txt', 'https://raw.githubusercontent.com/docker/compose/v5.6.0/cmd/compose/config.go'),
    ('node-http.txt', 'https://raw.githubusercontent.com/nodejs/node/v24.22.0/lib/_http_server.js')
]:
    path = work/filename
    supporting_sources.append({'url':url, 'path':str(path), 'sha256':h(path)})

result = {'checkedAt':datetime.now(timezone.utc).isoformat(),
          'savedArtifactHashesMatch':True, 'savedReceiptHashesMatch':True,
          'composeLiteralValuesPreserved':True, 'defaultParserChangedFields':2,
          'nodeShutdownCases':2, 'baseImagePlatforms':['linux/amd64', 'linux/arm64'],
          'supportingSources':supporting_sources,
          'receipts':{name:h(HERE/name) for name in ['source-input.json', 'compose-contract.json',
                      'lifecycle-contract.json', 'initial-observations.json']},
          'blueprints':{name:h(HERE/name) for name in ['Dockerfile', '.dockerignore', 'compose.yaml', '.env.example']},
          'verificationSha256':h(__file__), 'networkRequestsExecuted':False,
          'nativeFixturesRerun':False, 'imageBuilt':False, 'containerStarted':False,
          'realCredentialsUsed':False}
(HERE/'verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'savedHashesMatch':True, 'composeLiteralValuesPreserved':True,
                  'nodeShutdownCases':2, 'imageBuilt':False, 'containerStarted':False}))
