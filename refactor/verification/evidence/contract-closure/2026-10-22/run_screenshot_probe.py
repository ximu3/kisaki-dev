from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,os,shutil,subprocess
from probe_paths import ROOT, OUT, WORK
CACHE=ROOT/'node_modules/.cache/libmpv-design'
original=json.loads((ROOT/'refactor/verification/evidence/libmpv-screenshot/source-input.json').read_text(encoding='utf-8'))
build=json.loads((OUT/'screenshot-build.json').read_text(encoding='utf-8'))
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
crate=WORK/'probe';target=WORK/'probe-target';crate.mkdir(exist_ok=True)
for name in ['Cargo.toml','Cargo.lock','build.rs','binding.rs','producer.cpp']:
    shutil.copy2(Path(original['crate'])/name,crate/name)
script=(crate/'build.rs').read_text(encoding='utf-8')
script=script.replace('let root = manifest.ancestors().nth(4).unwrap();', 'let root = PathBuf::from(std::env::var_os("KISAKI_REFACTOR_ROOT").unwrap());')
(crate/'build.rs').write_text(script,encoding='utf-8')
cpp=(crate/'producer.cpp').read_text(encoding='utf-8')
old='    frame.screenshot_format = format->u.string;'
assert old in cpp
new=old+'\n    const auto* source = member(map, "source");\n    require(source->format == MPV_FORMAT_STRING, "Missing screenshot source.");\n    frame.screenshot_format += std::string("|") + source->u.string;'
(crate/'producer.cpp').write_text(cpp.replace(old,new),encoding='utf-8')
print('Building source-observing addon',flush=True)
result=subprocess.run(['cargo','build','--offline','--locked','-j8','--manifest-path',str(crate/'Cargo.toml'),'--target-dir',str(target)],cwd=ROOT,env=dict(os.environ,KISAKI_REFACTOR_ROOT=str(ROOT)),capture_output=True,text=True,creationflags=subprocess.CREATE_NO_WINDOW)
(WORK/'addon-build.log').write_text(result.stdout+result.stderr,encoding='utf-8')
if result.returncode:raise RuntimeError(result.stderr[-3000:])
addon=target/'screenshot-source-probe.node';shutil.copy2(target/'debug/libmpv_gpu_probe.dll',addon)
cases=[]
for scene in original['cases']:
    folder=WORK/'runs'/scene['name'];folder.mkdir(parents=True,exist_ok=True)
    lua=Path(scene['script']).read_text(encoding='utf-8')
    lua=lua.replace(Path(scene['metadata']).as_posix(),(folder/'observed.json').as_posix())
    (folder/'observe.lua').write_text(lua,encoding='utf-8')
    cases.append({**scene,'script':str(folder/'observe.lua'),'metadata':str(folder/'observed.json'),'output':str(folder/'result.json')})
inputs={**original,'addon':str(addon),'addonSha256':sha(addon),'dll':{'path':build['dll'],'sha256':build['dllSha256']},'cases':cases}
entry=WORK/'probe.mjs'
js=(ROOT/'refactor/verification/evidence/libmpv-screenshot/probe.mjs').read_text(encoding='utf-8')
js=js.replace("assert.equal(screenshot.format, 'rgba')", "const [format, source] = screenshot.format.split('|')\n  assert.equal(format, 'rgba')\n  assert.equal(source, scene.name === 'hdr-software' || scene.name === 'hdr-fallback' ? 'software' : 'vo')")
js=js.replace('      format: screenshot.format,','      format,\n      source,')
entry.write_text(js,encoding='utf-8')
(WORK/'source-input.json').write_text(json.dumps(inputs,indent=2),encoding='utf-8')
results=[]
for case in cases:
    print('Running '+case['name'],flush=True)
    process=subprocess.run(['node',str(entry),case['name']],cwd=ROOT,capture_output=True,text=True,timeout=40,creationflags=subprocess.CREATE_NO_WINDOW)
    if process.returncode:raise RuntimeError(case['name']+' '+process.stderr[-2500:])
    results.append({'name':case['name'],**json.loads(Path(case['output']).read_text(encoding='utf-8'))})
receipt={'checkedAt':datetime.now(timezone.utc).isoformat(),'scope':'Windows x64 source-provenance and pixel probe','cases':results,'publicBindingImplemented':False,'actualDeviceFailureInjected':False,'sourceBuild':build,'addonSha256':sha(addon)}
(OUT/'screenshot-results.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
print(json.dumps([{'name':x['name'],'source':x['screenshot']['source'],'independentBytes':x['independentBytesAfterCoreAndFrameRelease']} for x in results]),flush=True)
