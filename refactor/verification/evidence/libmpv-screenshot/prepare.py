"""Derive a screenshot-only change from the pinned GPU probe in a private cache."""
from pathlib import Path
from datetime import datetime, timezone
import difflib
import hashlib
import json
import shutil
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
EVIDENCE = HERE.parent
CACHE = ROOT / 'node_modules/.cache/libmpv-design'
h = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
native = json.loads((EVIDENCE/'libmpv-gpu/native-contract.json').read_text(encoding='utf-8'))
source = json.loads((EVIDENCE/'libmpv-sdr-integration/source-input.json').read_text(encoding='utf-8'))
engine = json.loads((EVIDENCE/'libmpv-package/engine-build.json').read_text(encoding='utf-8'))
graphics = json.loads((EVIDENCE/'libmpv-gpu/binary-input.json').read_text(encoding='utf-8'))
for entry in engine['files']:
    assert h(Path(engine['runtime'])/entry['name']) == entry['sha256']
dll = Path(engine['runtime'])/'libmpv-2.dll'
crate = Path(tempfile.mkdtemp(prefix='screenshot-src-', dir=CACHE))
target = Path(tempfile.mkdtemp(prefix='screenshot-build-', dir=CACHE))
work = Path(tempfile.mkdtemp(prefix='screenshot-run-', dir=CACHE))
originals = {}
for name in ['Cargo.toml', 'Cargo.lock', 'build.rs', 'binding.rs', 'producer.cpp']:
    original = EVIDENCE/'libmpv-gpu'/name
    assert h(original) == native['sources'][name]
    originals[name] = h(original)
    shutil.copy2(original, crate/name)
before = (crate/'producer.cpp').read_text(encoding='utf-8')
old = 'const char* command[] = {"screenshot-raw", "video", nullptr};'
new = 'const char* command[] = {"screenshot-raw", "subtitles", "rgba", nullptr};'
assert before.count(old) == 1
after = before.replace(old, new)
(crate/'producer.cpp').write_text(after, encoding='utf-8')
(HERE/'producer.patch').write_text(''.join(difflib.unified_diff(
    before.splitlines(True), after.splitlines(True), fromfile='a/producer.cpp', tofile='b/producer.cpp')),
    encoding='utf-8')
headers = {}
for header in graphics['directD3d11Headers']['files']:
    path = CACHE/'graphics/include/mpv'/header['path']
    assert h(path) == header['sha256']
    headers[str(path)] = h(path)
arguments = ['cargo', 'build', '--offline', '--locked', '-j', '8', '--manifest-path', str(crate/'Cargo.toml'),
             '--target-dir', str(target)]
process = subprocess.run(arguments, cwd=ROOT, capture_output=True, text=True, timeout=180,
                         creationflags=subprocess.CREATE_NO_WINDOW)
log = work/'build.log'
log.write_text(process.stdout+process.stderr, encoding='utf-8')
assert process.returncode == 0, log.read_text(encoding='utf-8')
addon = target/'screenshot-probe.node'
shutil.copy2(target/'debug/libmpv_gpu_probe.dll', addon)
subtitle = Path(source['work'])/'overlay.ass'
assert h(subtitle) == source['files'][str(subtitle)]
cases = []
for name, origin, software in [('srgb', 'srgb', False), ('p3', 'p3', False),
                                ('hdr-srgb', 'hdr-srgb', False), ('hdr-software', 'hdr-srgb', True)]:
    previous = next(value for value in source['cases'] if value['name'] == origin)
    media = Path(previous['media'])
    assert h(media) == source['files'][str(media)]
    folder = work/name
    folder.mkdir()
    metadata = folder/'observed.json'
    script = folder/'start.lua'
    options = {'target-prim':'display-p3' if origin == 'p3' else 'bt.709', 'target-trc':'srgb',
               'target-peak':'auto', 'tone-mapping':'auto', 'treat-srgb-as-power22':'no',
               'blend-subtitles':'no', 'keepaspect':'no', 'pause':'yes', 'osd-level':'0', 'hwdec':'no',
               'screenshot-sw':'yes' if software else 'no'}
    lua = ['local utils=require("mp.utils")', 'local recorded=false']
    lua += [f'assert(mp.set_property({json.dumps(key)}, {json.dumps(value)}))' for key,value in options.items()]
    lua += ['local function record()',
            ' if recorded or not mp.get_property("video-params/gamma") then return end',
            ' recorded=true',
            f' local file=assert(io.open({json.dumps(metadata.as_posix())},"w"))',
            ' file:write(utils.format_json({primaries=mp.get_property("target-prim"), transfer=mp.get_property("target-trc"),',
            '  peak=mp.get_property("target-peak"), sourceTransfer=mp.get_property("video-params/gamma"),',
            '  sourcePrimaries=mp.get_property("video-params/primaries"), sourceFormat=mp.get_property("video-params/pixelformat"),',
            '  softwareScreenshot=mp.get_property_native("screenshot-sw"), subtitle=mp.get_property_native("sid")}));file:close()',
            'end', 'mp.register_event("file-loaded",record)',
            'mp.observe_property("video-params","native",function(_,value) if value and value.gamma then record() end end)']
    suboption = f', ["sub-file"]={json.dumps(subtitle.as_posix())}' if origin == 'hdr-srgb' else ''
    lua += [f'assert(mp.command_native({{"loadfile",{json.dumps(media.as_posix())},"replace",-1,{{["sub-auto"]="no"{suboption}}}}}))']
    script.write_text('\n'.join(lua)+'\n', encoding='utf-8')
    cases.append({'name':name, 'target':previous['target'], 'software':software, 'media':str(media),
                  'script':str(script), 'metadata':str(metadata), 'points':previous['points'],
                  'output':str(folder/'result.json')})
files = [subtitle, *{Path(case['media']) for case in cases}, *[Path(case['script']) for case in cases]]
inputs = {'preparedAt':datetime.now(timezone.utc).isoformat(), 'work':str(work), 'crate':str(crate),
          'addon':str(addon), 'addonSha256':h(addon), 'dll':{'path':str(dll), 'sha256':h(dll)},
          'engineReceiptSha256':h(EVIDENCE/'libmpv-package/engine-build.json'),
          'sourceReceiptSha256':h(EVIDENCE/'libmpv-sdr-integration/source-input.json'),
          'originalProbeSources':originals, 'derivedProducerSha256':h(crate/'producer.cpp'),
          'patchSha256':h(HERE/'producer.patch'), 'headers':headers,
          'build':{'arguments':arguments, 'log':str(log), 'logSha256':h(log)},
          'sourceColors':source['sourceColors'], 'p3Expected':source['p3Expected'],
          'hdrRequestedNits':source['hdrRequestedNits'], 'cases':cases,
          'files':{str(path):h(path) for path in files}, 'prepareSha256':h(__file__)}
(HERE/'source-input.json').write_text(json.dumps(inputs, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'cases':len(cases), 'addon':str(addon), 'dllSha256':h(dll)}))
