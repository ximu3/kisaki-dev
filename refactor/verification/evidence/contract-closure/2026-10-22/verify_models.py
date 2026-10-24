from pathlib import Path
import hashlib,json
from probe_paths import ROOT, OUT, WORK
checks=[]
def check(name, value):
    assert value,name
    checks.append(name)

def clock_segments(samples):
    wall,mono=samples[0];anchor=(wall,mono);last=anchor;segments=[]
    for wall,mono in samples[1:]:
        projected=anchor[0]+mono-anchor[1]
        if abs(wall-projected)>1000:
            if last[1]>anchor[1]:segments.append((anchor[0],anchor[0]+last[1]-anchor[1],last[1]-anchor[1]))
            anchor=(wall,mono)
        last=(wall,mono)
    if last[1]>anchor[1]:segments.append((anchor[0],anchor[0]+last[1]-anchor[1],last[1]-anchor[1]))
    return segments
normal=clock_segments([(100000,0),(105000,5000),(110000,10000)])
back=clock_segments([(100000,0),(105000,5000),(90000,10000),(95000,15000)])
forward=clock_segments([(100000,0),(105000,5000),(200000,10000),(205000,15000)])
check('stable clock keeps one interval',normal==[(100000,110000,10000)])
check('backward correction preserves prior interval and omits gap',back==[(100000,105000,5000),(90000,95000,5000)])
check('forward correction preserves prior interval and omits gap',forward==[(100000,105000,5000),(200000,205000,5000)])
check('tolerance boundary keeps anchor',clock_segments([(100000,0),(106000,5000),(110000,10000)])==normal)
check('all saved intervals preserve positive span and duration',all(b>a and 0<=d<=b-a for rows in [normal,back,forward] for a,b,d in rows))

def match(candidates, keys, local, allow_create=True):
    for fields in keys:
        if not all(k in candidates and candidates[k] is not None for k in fields):continue
        found=[x for x in local if all(x.get(k)==candidates[k] for k in fields)]
        if len(found)>1:return 'ambiguous'
        if len(found)==1:return found[0]['id']
    usable=any(all(k in candidates and candidates[k] is not None for k in fields) for fields in keys)
    return 'create' if allow_create and (usable or not local) else 'insufficient'
local=[{'id':'v1','numberLabel':'1'}]
check('unidentified volume reuses unique match',match({'numberLabel':'1'},[['numberLabel']],local)=='v1')
check('duplicate volume is ambiguous',match({'numberLabel':'1'},[['numberLabel']],local+[{'id':'v2','numberLabel':'1'}])=='ambiguous')
check('missing matching rules cannot recreate existing volume',match({'numberLabel':'1'},[],local)=='insufficient')
check('empty scope may initialize explicit member',match({},[],[])=='create')
check('fields-only adoption cannot create a part',match({'numberLabel':'2'},[['numberLabel']],local,False)=='insufficient')

pixel_receipt=OUT/'screenshot-results.json'
if not pixel_receipt.exists():pixel_receipt=Path(__file__).parent/'screenshot-results.json'
pixels=json.loads(pixel_receipt.read_text(encoding='utf-8'))
rows={x['name']:x for x in pixels['cases']}
inputs=json.loads((ROOT/'refactor/verification/evidence/libmpv-screenshot/source-input.json').read_text(encoding='utf-8'))
def difference(a,b):return max(abs(x-y) for aa,bb in zip(a,b) for x,y in zip(aa[:3],bb[:3]))
for name in ['srgb','p3','hdr-srgb']:
    check(name+' screenshot matches GPU samples',difference(rows[name]['screenshot']['samples'],rows[name]['frame']['samples'])<=2)
check('sRGB independent reference preserved',difference(rows['srgb']['screenshot']['samples'],inputs['sourceColors'])<=2)
check('Display P3 independent reference preserved',difference(rows['p3']['screenshot']['samples'],inputs['p3Expected'])<=2)
check('forced fallback matches software pixels',difference(rows['hdr-fallback']['screenshot']['samples'],rows['hdr-software']['screenshot']['samples'])<=2)
check('forced fallback is observably different from SDR',difference(rows['hdr-fallback']['screenshot']['samples'],rows['hdr-srgb']['screenshot']['samples'])>20)
def accepts_sdr(source, renderer='gpu', target='srgb'):
    return source=='vo' and renderer=='gpu' and target=='srgb'
check('host policy accepts verified GPU path',accepts_sdr(rows['hdr-srgb']['screenshot']['source']))
check('host policy rejects fallback with screenshot-sw disabled',not accepts_sdr(rows['hdr-fallback']['screenshot']['source']) and rows['hdr-fallback']['observed']['softwareScreenshot'] is False)
check('host policy rejects missing and unknown provenance',not accepts_sdr(None) and not accepts_sdr('unknown'))
pixels['fallbackInjection'].pop('hostAcceptance',None)
pixels['fallbackInjection']['hostPolicyModel']='rejected before image preparation'
pixels['formalHostExecuted']=False
result={'scope':'deterministic contract models and recorded native pixels; not production implementations','checks':checks,'count':len(checks),'clock':{'normal':normal,'backward':back,'forward':forward},'formalHostExecuted':False}
(OUT/'model-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({'passed':len(checks),'formalHostExecuted':False}))
