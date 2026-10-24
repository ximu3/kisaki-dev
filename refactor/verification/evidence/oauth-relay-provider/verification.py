"""Verify the sanitized receipts and completed cleanup, without account requests."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json

HERE = Path(__file__).resolve().parent
h = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
rows = []
for name, filename in [('anilist', 'live-contract.json'), ('bangumi', 'bangumi-contract.json')]:
    receipt = json.loads((HERE/filename).read_text(encoding='utf-8'))
    assert receipt['moduleSha256'] == h(HERE/'live-probe.mjs')
    assert receipt['listenerClosed'] and receipt['realProviderOperationsExecuted']
    assert not receipt['personalRecordsModified'] and not receipt['deploymentChanged']
    assert not receipt['credentialsPersisted']
    assert len(receipt['providers']) == 1
    provider = receipt['providers'][0]
    assert provider['provider'] == name
    assert provider['registrationChanged'] and provider['originalCallbackRestored']
    assert [case['mode'] for case in provider['cases']] == ['correct', 'mismatched', 'omitted']
    for case in provider['cases']:
        assert case['stateMatched'] and case['challengeMethod'] == 'S256'
        assert case['verifierSent'] == (case['mode'] != 'omitted')
        assert case['exchange']['httpStatus'] == 200
        assert case['exchange']['result'] == 'token_issued'
        assert case['exchange']['tokenFields']['accessToken']
    refresh = provider['cases'][0]['refresh']
    assert refresh['httpStatus'] == 200 and refresh['result'] == 'token_issued'
    assert refresh['tokenFields']['accessToken'] and refresh['tokenFields']['refreshToken']
    rows.append({'provider':name, 'correctVerifierAccepted':True, 'wrongVerifierAccepted':True,
                 'missingVerifierAccepted':True, 'stateMatched':True, 'refreshSucceeded':True,
                 's256EnforcedForTestedRegistration':False, 'originalCallbackRestored':True,
                 'listenerClosed':True, 'receiptSha256':h(HERE/filename)})
assert not (HERE/'anilist-callback-restored.png').exists()
result = {'checkedAt':datetime.now(timezone.utc).isoformat(), 'providers':rows,
          'authorizationCodeExchanges':6, 'refreshRequests':2,
          'runtimeVersionIdentified':False,
          'upstreamGrantRevocationExecuted':False,
          'uiCredentialExposureOccurred':True,
          'accidentalCredentialImageRemoved':True,
          'finalResultImages':{name:h(HERE/name) for name in ['anilist-results.png','bangumi-results.png']},
          'verificationSha256':h(__file__)}
(HERE/'verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'providers':2,'authorizationCodeExchanges':6,'refreshRequests':2,
                  'callbacksRestored':True,'listenersClosed':True,'s256Enforced':False}))
