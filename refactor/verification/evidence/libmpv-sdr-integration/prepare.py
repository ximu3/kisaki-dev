"""Prepare owned SDR references and reuse the pinned native and HDR inputs."""
from pathlib import Path
import hashlib
import json
import struct
import tempfile
import zlib

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
EVIDENCE = HERE.parent
CACHE = ROOT / 'node_modules/.cache/libmpv-design'
work = Path(tempfile.mkdtemp(prefix='sdr-integration-', dir=CACHE))
h = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
native = json.loads((EVIDENCE/'libmpv-gpu/native-contract.json').read_text(encoding='utf-8'))
build = json.loads((EVIDENCE/'libmpv-upstream-fix/patched-build.json').read_text(encoding='utf-8'))
graphics = json.loads((EVIDENCE/'libmpv-gpu/binary-input.json').read_text(encoding='utf-8'))
composition = json.loads((EVIDENCE/'libmpv-composition/native-contract.json').read_text(encoding='utf-8'))
addon = CACHE / 'gpu-target/libmpv-gpu-probe.node'
assert h(addon) == native['addonSha256']
assert h(build['dll']['path']) == build['dll']['sha256']
for name in ['producer.cpp', 'binding.rs']:
    assert h(EVIDENCE/'libmpv-gpu'/name) == native['sources'][name]
hdr = composition['inputFiles']['steps']
assert h(hdr['path']) == hdr['sha256']

colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [128, 64, 32], [255, 255, 255], [0, 0, 0]]
def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
pixels = b''.join(b'\0' + b''.join(bytes([128,128,128] if 27<=x<=35 and 19<=y<=27 else colors[(0 if y < 24 else 1) * 3 + min(x//21, 2)])
                                for x in range(63)) for y in range(47))
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 63, 47, 8, 2, 0, 0, 0))
png += chunk(b'sRGB', b'\0') + chunk(b'IDAT', zlib.compress(pixels)) + chunk(b'IEND', b'')
source = work/'srgb.png'; source.write_bytes(png)
subtitle = work/'overlay.ass'
subtitle.write_text('''[Script Info]
ScriptType: v4.00+
PlayResX: 63
PlayResY: 47
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,12,&H000000FF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:10.00,Default,,0,0,0,,{\\an7\\pos(0,0)\\p1}m 0 32 l 20 32 20 46 0 46
''', encoding='utf-8')

def solve(matrix, vector):
    rows = [list(row) + [value] for row, value in zip(matrix, vector)]
    for column in range(3):
        pivot = max(range(column, 3), key=lambda row: abs(rows[row][column]))
        rows[column], rows[pivot] = rows[pivot], rows[column]
        scale = rows[column][column]
        rows[column] = [value / scale for value in rows[column]]
        for row in range(3):
            if row != column:
                scale = rows[row][column]
                rows[row] = [a-scale*b for a,b in zip(rows[row],rows[column])]
    return [row[3] for row in rows]

def matrix(primaries):
    columns = [[x/y, 1, (1-x-y)/y] for x,y in primaries]
    values = list(map(list, zip(*columns)))
    scale = solve(values, [0.3127/0.3290, 1, (1-0.3127-0.3290)/0.3290])
    return [[value*scale[column] for column,value in enumerate(row)] for row in values]

srgb = matrix([(0.64, 0.33), (0.30, 0.60), (0.15, 0.06)])
p3 = matrix([(0.68, 0.32), (0.265, 0.69), (0.15, 0.06)])
def convert(color):
    encoded = [value/255 for value in color]
    linear = [value/12.92 if value <= 0.04045 else ((value+0.055)/1.055)**2.4 for value in encoded]
    xyz = [sum(a*b for a,b in zip(row,linear)) for row in srgb]
    result = solve(p3, xyz)
    return [round(255*(12.92*max(value,0) if value <= 0.0031308 else 1.055*value**(1/2.4)-0.055)) for value in result]

cases = []
for name, target, media in [('srgb','srgb',str(source)),('p3','display-p3',str(source)),('hdr-srgb','srgb',hdr['path'])]:
    folder = work/name; folder.mkdir()
    metadata = folder/'observed.json'; script = folder/'start.lua'
    options = {'target-prim':'display-p3' if target=='display-p3' else 'bt.709', 'target-trc':'srgb',
               'target-peak':'auto', 'tone-mapping':'auto', 'treat-srgb-as-power22':'no',
               'blend-subtitles':'no', 'keepaspect':'no', 'pause':'yes', 'osd-level':'0', 'hwdec':'no'}
    lua = ['local utils=require("mp.utils")', 'local recorded=false']
    lua += [f'assert(mp.set_property({json.dumps(key)}, {json.dumps(value)}))' for key,value in options.items()]
    lua += ['local function record()',
            ' if recorded or not mp.get_property("video-params/gamma") then return end',
            ' recorded=true',
            f' local file=assert(io.open({json.dumps(metadata.as_posix())},"w"))',
            ' file:write(utils.format_json({primaries=mp.get_property("target-prim"), transfer=mp.get_property("target-trc"),',
            '  peak=mp.get_property("target-peak"), sourceTransfer=mp.get_property("video-params/gamma"),',
            '  sourcePrimaries=mp.get_property("video-params/primaries"), sourceFormat=mp.get_property("video-params/pixelformat"),',
            '  subtitle=mp.get_property_native("sid")}));file:close()', 'end',
            'mp.register_event("file-loaded",record)',
            'mp.observe_property("video-params","native",function(_,value) if value and value.gamma then record() end end)']
    suboption = f', ["sub-file"]={json.dumps(subtitle.as_posix())}' if name=='hdr-srgb' else ''
    lua += [f'assert(mp.command_native({{"loadfile",{json.dumps(Path(media).as_posix())},"replace",-1,{{["sub-auto"]="no"{suboption}}}}}))']
    script.write_text('\n'.join(lua)+'\n',encoding='utf-8')
    points = ([[ (i%3+0.5)/3, (i//3+0.5)/2] for i in range(6)] if name!='hdr-srgb'
              else [[(i+0.5)/7,0.3] for i in range(7)]+[[0.1,0.82]])
    cases.append({'name':name,'target':target,'media':media,'script':str(script),'metadata':str(metadata),
                  'points':points,'userData':str(folder/'profile'),'output':str(folder/'result.json')})

inputs = {'work':str(work),'addon':str(addon),'addonSha256':h(addon),'dll':build['dll'],
          'electron':graphics['electron'],'electronExeSha256':h(Path(graphics['electron']['runtime'])/'electron.exe'),
          'sourceColors':colors,'p3Expected':[convert(color) for color in colors],
          'hdrRequestedNits':[0.1,10,100,203,400,1000,4000],'cases':cases,
          'files':{str(file):h(file) for file in [source,subtitle,Path(hdr['path']),*[Path(case['script']) for case in cases]]},
          'originalProbeSources':{name:native['sources'][name] for name in ['producer.cpp','binding.rs']},
          'prepareSha256':h(__file__)}
(HERE/'source-input.json').write_text(json.dumps(inputs,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'cases':len(cases),'sourceColors':colors,'p3Expected':inputs['p3Expected']}))
