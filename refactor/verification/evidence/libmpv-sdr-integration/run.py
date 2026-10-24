"""Execute three linked SDR scenes, reusing the unchanged GPU addon and fixed engine."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import subprocess

HERE=Path(__file__).resolve().parent
inputs=json.loads((HERE/'source-input.json').read_text(encoding='utf-8'))
h=lambda file:hashlib.sha256(Path(file).read_bytes()).hexdigest()
assert h(inputs['addon'])==inputs['addonSha256'] and h(inputs['dll']['path'])==inputs['dll']['sha256']
executable=Path(inputs['electron']['runtime'])/'electron.exe'
assert h(executable)==inputs['electronExeSha256']
for file,digest in inputs['files'].items():assert h(file)==digest,file
environment=dict(os.environ);environment.pop('ELECTRON_RUN_AS_NODE',None)
results=[]
for case in inputs['cases']:
    process=subprocess.run([str(executable),str(HERE/'main.cjs'),case['name']],env=environment,
                           capture_output=True,text=True,timeout=40,creationflags=subprocess.CREATE_NO_WINDOW)
    assert process.returncode==0,(case['name'],process.returncode,process.stderr)
    result=json.loads(Path(case['output']).read_text(encoding='utf-8'))
    assert result['allImportsReleased']
    results.append({'name':case['name'],**result})

def close(actual,expected,tolerance):
    return all(abs(a-b)<=tolerance for a,b in zip(actual[:3],expected)) and actual[3]==255
for case in results:
    for frame in case['imported']:
        if case['name'] in ['srgb','p3']:
            expected=inputs['p3Expected'] if case['name']=='p3' else inputs['sourceColors']
            assert all(close(a,b,2) for a,b in zip(frame['native'],expected)),(case['name'],'native',frame['native'],expected)
            assert all(close(a,b,3) for a,b in zip(frame['srgb'],inputs['sourceColors'])),(case['name'],'srgb',frame['srgb'])
            assert all(close(a,b,3) for a,b in zip(frame['p3'],inputs['p3Expected'])),(case['name'],'p3',frame['p3'])
        else:
            assert case['observed']['sourceTransfer']=='pq' and case['observed']['sourcePrimaries']=='bt.2020'
            assert case['observed']['sourceFormat']=='yuv420p10' and case['observed']['subtitle']==1
            shades=frame['native'][:7]
            assert all(pixel[3]==255 and max(pixel[:3])-min(pixel[:3])<=2 for pixel in shades),shades
            assert all(a[0]<b[0] for a,b in zip(shades,shades[1:])),shades
            assert all(close(a,b[:3],3) for a,b in zip(frame['srgb'],frame['native'])),frame
            assert close(frame['native'][-1],[255,0,0],3),frame['native'][-1]
p3=next(value for value in results if value['name']=='p3')
wrong=max(abs(a-b) for pixel,source in zip(p3['wrongTag']['srgb'],inputs['sourceColors']) for a,b in zip(pixel[:3],source))
assert wrong>10,wrong
receipt={'checkedAt':datetime.now(timezone.utc).isoformat(),'cases':results,'wrongTagMaxError':wrong,
         'sourceReceiptSha256':h(HERE/'source-input.json'),
         'sources':{name:h(HERE/name) for name in ['prepare.py','run.py','main.cjs','preload.cjs']},
         'actualScreenCaptureExecuted':False,'physicalHdrDisplayVerified':False,'nativeAddonRebuilt':False,
         'macosExecuted':False,'linuxExecuted':False}
(HERE/'sdr-contract.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'cases':len(results),'frames':sum(len(value['imported']) for value in results),'wrongTagMaxError':wrong}))
