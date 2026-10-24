from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,os,shlex,shutil,subprocess
from probe_paths import ROOT, OUT, WORK
CACHE=ROOT/'node_modules/.cache/libmpv-design'
source=WORK/'mpv/player/screenshot.c';old=source.read_bytes()
input_path=WORK/'source-input.json'
original_input=input_path.read_bytes()
needle=b'    image = ctrl.res;'
assert old.count(needle)==1
injected=b'    if (ctrl.res) {\n        talloc_free(ctrl.res);\n        ctrl.res = NULL;\n    }\n'+needle
try:
    source.write_bytes(old.replace(needle,injected))
    inp=json.loads((ROOT/'refactor/verification/evidence/libmpv-package/engine-input.json').read_text(encoding='utf-8'))
    def posix(p):
        p=Path(p).resolve();return '/'+p.drive[0].lower()+p.as_posix()[2:]
    prefix=Path(inp['work'])/'prefix'
    bins=[prefix/'bin']+[Path(x['directory'])/('ucrt64/bin' if x['name'].startswith('mingw-') else 'usr/bin') for x in inp['inputs'] if x['kind']=='build-tool']
    path=':'.join(posix(p) for p in bins)+':/ucrt64/bin:/usr/bin:/c/Windows/System32'
    command='export PATH='+shlex.quote(path)+'\nexec '+shlex.join(['meson','compile','-C',posix(WORK/'build'),'-j8'])
    log=WORK/'fallback-compile.log'
    with log.open('w',encoding='utf-8') as stream:
        result=subprocess.run([str(CACHE/'engine-build/msys64/usr/bin/bash.exe'),'--login','-c',command],env=dict(os.environ,MSYSTEM='UCRT64',CHERE_INVOKING='1'),cwd=WORK,stdout=stream,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:raise RuntimeError(log.read_text(encoding='utf-8')[-3000:])
    runtime=WORK/'fallback-runtime';shutil.copytree(WORK/'runtime',runtime)
    shutil.copy2(WORK/'build/libmpv-2.dll',runtime/'libmpv-2.dll')
    inputs=json.loads((WORK/'source-input.json').read_text(encoding='utf-8'))
    original=next(x for x in inputs['cases'] if x['name']=='hdr-srgb')
    folder=WORK/'runs/hdr-fallback';folder.mkdir(parents=True)
    lua=Path(original['script']).read_text(encoding='utf-8').replace(Path(original['metadata']).as_posix(),(folder/'observed.json').as_posix())
    (folder/'observe.lua').write_text(lua,encoding='utf-8')
    case={**original,'name':'hdr-fallback','script':str(folder/'observe.lua'),'metadata':str(folder/'observed.json'),'output':str(folder/'result.json')}
    inputs['cases'].append(case);inputs['dll']['path']=str(runtime/'libmpv-2.dll')
    (WORK/'source-input.json').write_text(json.dumps(inputs,indent=2),encoding='utf-8')
    process=subprocess.run(['node',str(WORK/'probe.mjs'),'hdr-fallback'],cwd=ROOT,capture_output=True,text=True,timeout=40,creationflags=subprocess.CREATE_NO_WINDOW)
    if process.returncode:raise RuntimeError(process.stderr[-2500:])
    observed=json.loads(Path(case['output']).read_text(encoding='utf-8'))
    assert observed['observed']['softwareScreenshot'] is False
    assert observed['screenshot']['source']=='software'
    normal=json.loads((OUT/'screenshot-results.json').read_text(encoding='utf-8'))
    normal['cases'].append({'name':'hdr-fallback',**observed})
    normal['fallbackInjection']={'kind':'discard successful VO screenshot before the existing fallback branch','productionPatchModified':False,'normalSourceSha256':hashlib.sha256(old).hexdigest(),'injectedSourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'injectedDllSha256':hashlib.sha256((runtime/'libmpv-2.dll').read_bytes()).hexdigest(),'screenshotSwOption':False,'reportedSource':'software','hostPolicyModel':'rejected before image preparation'}
    normal['formalHostExecuted']=False
    normal['checkedAt']=datetime.now(timezone.utc).isoformat()
    (OUT/'screenshot-results.json').write_text(json.dumps(normal,indent=2),encoding='utf-8')
finally:
    source.write_bytes(old)
    input_path.write_bytes(original_input)
print(json.dumps(normal['fallbackInjection']),flush=True)
