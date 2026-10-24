"""Prepare pinned graphics-probe inputs without installing a desktop runtime."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import struct
import zlib
import urllib.request
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / "node_modules/.cache/libmpv-design/graphics"
VERSION = "44.5.1"
ARCHIVE_SHA = "9b382492dcfee91f8f9e92c91f7972550a1b95d2299cac72279dab33a600d7db"
ANGLE = "b82a564646a26535ccedfa7a69134c0fd6654ac2"
MPV = "01e2533f3143b8940857ca419b0b367f583e05ca"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def download(url, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=60) as response, path.open("wb") as output:
        while block := response.read(1024 * 1024):
            output.write(block)


CACHE.mkdir(parents=True, exist_ok=True)
archive = CACHE / f"electron-v{VERSION}-win32-x64.zip"
url = f"https://github.com/electron/electron/releases/download/v{VERSION}/{archive.name}"
if not archive.is_file():
    download(url, archive)
assert archive.stat().st_size == 157998329
assert digest(archive) == ARCHIVE_SHA
runtime = CACHE / f"electron-{VERSION}"
runtime.mkdir(exist_ok=True)
with zipfile.ZipFile(archive) as package:
    for item in package.infolist():
        target = (runtime / item.filename).resolve()
        assert target.is_relative_to(runtime.resolve())
    package.extractall(runtime)

headers = []
for name in ["EGL/egl.h", "EGL/eglext.h", "EGL/eglext_angle.h", "EGL/eglplatform.h", "GLES3/gl3.h",
             "GLES3/gl3platform.h", "KHR/khrplatform.h"]:
    path = CACHE / "include" / name
    source = f"https://raw.githubusercontent.com/google/angle/{ANGLE}/include/{name}"
    if not path.is_file():
        download(source, path)
    headers.append({"path": name, "source": source, "sha256": digest(path)})

native_headers = []
for name in ["client.h", "render.h", "render_d3d11.h"]:
    path = CACHE / "include/mpv" / name
    source = f"https://raw.githubusercontent.com/mpv-player/mpv/{MPV}/include/mpv/{name}"
    if not path.is_file():
        download(source, path)
    native_headers.append({"path": name, "source": source, "sha256": digest(path)})

producer_source = ROOT / "apps/desktop/node_modules/electron/dist"
producer_version = (producer_source / "version").read_text(encoding="utf-8").strip()
assert producer_version == "41.2.0"
producer_angle = CACHE / "producer-angle-electron-41.2.0"
producer_angle.mkdir(exist_ok=True)
for name in ["libEGL.dll", "libGLESv2.dll", "d3dcompiler_47.dll"]:
    shutil.copy2(producer_source / name, producer_angle / name)

# A small deterministic source makes orientation, channel order and resizing observable.
width, height = 63, 47
pixels = bytearray()
for y in range(height):
    for x in range(width):
        pixels.extend((128, 128, 128) if width//3 < x < 2*width//3 and height//3 < y < 2*height//3 else
                      (255, 0, 0) if x < width // 2 and y < height // 2 else
                      (0, 255, 0) if y < height // 2 else
                      (0, 0, 255) if x < width // 2 else (255, 255, 255))
sample = CACHE / "quadrants.ppm"
sample.write_bytes(f"P6\n{width} {height}\n255\n".encode() + pixels)

def png_sample(alpha, name):
    def chunk(kind, data):
        return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    rows=bytearray()
    for row in range(height):
        rows.append(0)
        for column in range(width):
            start=(row*width+column)*3
            rows.extend(pixels[start:start+3]);rows.append(alpha)
    data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,6,0,0,0))
    data+=chunk(b'sRGB',b'\0')+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')
    path=CACHE/name;path.write_bytes(data)
    return {'path':str(path),'sha256':digest(path),'alpha':alpha}

alpha_samples = [png_sample(255,'opaque.png'),png_sample(128,'half-alpha.png')]

generator = Path(shutil.which('ffmpeg'))
movie = CACHE / 'clock-sample.mkv'
generated = subprocess.run([str(generator), '-nostdin', '-v', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=64x48:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=8000',
    '-t', '1.5', '-c:v', 'ffv1', '-c:a', 'pcm_s16le', '-fflags', '+bitexact',
    '-flags:v', '+bitexact', str(movie)], capture_output=True, text=True, timeout=20,
    creationflags=subprocess.CREATE_NO_WINDOW)
assert generated.returncode == 0, generated.stderr
generator_version = subprocess.run([str(generator), '-version'],capture_output=True,text=True,
    timeout=10,creationflags=subprocess.CREATE_NO_WINDOW).stdout.splitlines()[0]

receipt = {
    "checkedAt": datetime.now(timezone.utc).isoformat(),
    "electron": {"version": VERSION, "source": url, "archiveSha256": ARCHIVE_SHA,
                 "runtime": str(runtime), "selectedConsumerVersion": True},
    "angle": {"headersCommit": ANGLE, "headers": headers,
              "probeBinariesFrom": "existing Electron 41.2.0 installation", "selectedForLibraryRelease": False,
              "directory": str(producer_angle),
              "files": {name: digest(producer_angle / name) for name in
                        ["libEGL.dll", "libGLESv2.dll", "d3dcompiler_47.dll"]}},
    "sample": {"path": str(sample), "sha256": digest(sample), "width": width, "height": height},
    "movie": {"path": str(movie), "sha256": digest(movie), "seconds": 1.5,
              "generator": generator_version, "generatorSha256": digest(generator)},
    "alphaSamples": alpha_samples,
    "independentAnglePackagingVerified": False,
    "directD3d11Headers": {"commit": MPV, "files": native_headers, "selectedForRelease": False},
}
(HERE / "binary-input.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"electron": VERSION, "headers": len(headers), "sample": [width, height]}))
