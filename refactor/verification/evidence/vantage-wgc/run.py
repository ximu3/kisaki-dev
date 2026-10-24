"""Run the owned WGC fixture and encode its unchanged RGBA capture as PNG."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import struct
import subprocess
import tempfile
import zlib

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT/'node_modules/.cache/platform-design'
work = Path(tempfile.mkdtemp(prefix='wgc-', dir=CACHE))
binary = CACHE/'wgc-target/debug/vantage-wgc-probe.exe'
pixels = work/'capture.rgba'
env = dict(os.environ)
env['VANTAGE_PROBE_PIXELS'] = str(pixels)
process = subprocess.run([str(binary)], cwd=work, env=env, capture_output=True, text=True,
                         timeout=25, creationflags=subprocess.CREATE_NO_WINDOW)
(work/'stderr.txt').write_text(process.stderr, encoding='utf-8')
assert process.returncode == 0, process.stderr
capture = json.loads(process.stdout)
assert capture['cursorDisabled'] and capture['poolClosed'] and capture['sessionClosed']
assert capture['windowDestroyed'] and not capture['fixtureWasForeground']
data = pixels.read_bytes()
assert len(data) == capture['width'] * capture['height'] * 4 == capture['rgbaBytes']
expected = [[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,255,255]]
assert all(abs(a-b) <= 3 for row, want in zip(capture['samples'], expected) for a,b in zip(row,want))
assert capture['captureFormat'] == 'rgba16float' and capture['toneMapping'] == 'Direct2D'
assert capture['alphaMode'] == 'straight'
shades = capture['hdrSamples']
assert all(max(row[:3])-min(row[:3]) <= 1 and row[3] == 255 for row in shades)
assert 0 < shades[0][0] < shades[1][0] < shades[2][0] <= 255

def chunk(kind, value):
    return struct.pack('>I',len(value))+kind+value+struct.pack('>I',zlib.crc32(kind+value)&0xffffffff)

stride = capture['width'] * 4
rows = b''.join(b'\0'+data[y*stride:(y+1)*stride] for y in range(capture['height']))
png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR',struct.pack('>IIBBBBB',capture['width'],capture['height'],8,6,0,0,0))
png += chunk(b'sRGB',b'\0')
png += chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')
(HERE/'capture.png').write_bytes(png)
h = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
receipt = {'checkedAt':datetime.now(timezone.utc).isoformat(), 'capture':capture,
           'binary':str(binary), 'binarySha256':h(binary), 'work':str(work),
           'pixelSha256':h(pixels), 'pngSha256':h(HERE/'capture.png'),
           'sources':{name:h(HERE/name) for name in ['Cargo.toml','Cargo.lock','build.rs','main.rs','capture.cpp','color.cpp','color.h','run.py']},
           'processExitCode':process.returncode, 'stderr':process.stderr,
           'windowsWgcExecuted':True, 'ownedD3D11WindowOnly':True,
           'displaySettingsChanged':False, 'macosExecuted':False, 'linuxExecuted':False,
           'productionVantageImplemented':False, 'cancellationRaceTested':False,
           'hdrCaptureTested':False, 'nativeHdrToneMapTested':True, 'mixedPrivilegeTested':False}
(HERE/'capture-contract.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'width':capture['width'], 'height':capture['height'], 'frames':capture['framesSeen'],
                  'patternMatched':True, 'resourcesClosed':True}))
