"""Read Windows display state and run an explicitly requested temporary HDR check."""
from datetime import datetime, timezone
from pathlib import Path
import ctypes as C
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/libmpv-design/playback'
U, I = C.c_uint32, C.c_int32


class Luid(C.Structure):
    _fields_ = [('low', U), ('high', I)]


class Rational(C.Structure):
    _fields_ = [('n', U), ('d', U)]


class Point(C.Structure):
    _fields_ = [('x', I), ('y', I)]


class Source(C.Structure):
    _fields_ = [('adapter', Luid), ('id', U), ('mode', U), ('status', U)]


class Target(C.Structure):
    _fields_ = [('adapter', Luid), ('id', U), ('mode', U), ('technology', U),
                ('rotation', U), ('scaling', U), ('rate', Rational),
                ('scanline', U), ('available', I), ('status', U)]


class DisplayPath(C.Structure):
    _fields_ = [('source', Source), ('target', Target), ('flags', U)]


class SourceMode(C.Structure):
    _fields_ = [('width', U), ('height', U), ('format', U), ('position', Point)]


class ModeData(C.Union):
    _fields_ = [('source', SourceMode), ('raw', C.c_uint64 * 6)]


class Mode(C.Structure):
    _fields_ = [('type', U), ('id', U), ('adapter', Luid), ('data', ModeData)]


class Header(C.Structure):
    _fields_ = [('type', U), ('size', U), ('adapter', Luid), ('id', U)]


class SourceName(C.Structure):
    _fields_ = [('header', Header), ('name', C.c_wchar * 32)]


class TargetName(C.Structure):
    _fields_ = [('header', Header), ('flags', U), ('technology', U),
                ('manufacturer', C.c_uint16), ('product', C.c_uint16),
                ('connector', U), ('name', C.c_wchar * 64), ('device_path', C.c_wchar * 128)]


class Color(C.Structure):
    _fields_ = [('header', Header), ('flags', U), ('encoding', U), ('bits', U)]


class White(C.Structure):
    _fields_ = [('header', Header), ('level', U)]


class ColorState(C.Structure):
    _fields_ = [('header', Header), ('value', U)]


assert C.sizeof(DisplayPath) == 72 and C.sizeof(Mode) == 64 and C.sizeof(Header) == 20
assert C.sizeof(TargetName) == 420 and C.sizeof(Color) == 32 and C.sizeof(ColorState) == 24
api = C.WinDLL('user32')
api.GetDisplayConfigBufferSizes.argtypes = [U, C.POINTER(U), C.POINTER(U)]
api.GetDisplayConfigBufferSizes.restype = I
api.QueryDisplayConfig.argtypes = [U, C.POINTER(U), C.POINTER(DisplayPath),
                                  C.POINTER(U), C.POINTER(Mode), C.c_void_p]
api.QueryDisplayConfig.restype = I
api.DisplayConfigGetDeviceInfo.argtypes = [C.POINTER(Header)]
api.DisplayConfigGetDeviceInfo.restype = I
api.DisplayConfigSetDeviceInfo.argtypes = [C.POINTER(Header)]
api.DisplayConfigSetDeviceInfo.restype = I


def query(cls, kind, adapter, identifier):
    value = cls()
    value.header = Header(kind, C.sizeof(cls), adapter, identifier)
    result = api.DisplayConfigGetDeviceInfo(C.byref(value.header))
    return value, result


def displays():
    for _ in range(3):
        pc, mc = U(), U()
        assert api.GetDisplayConfigBufferSizes(2, C.byref(pc), C.byref(mc)) == 0
        assert pc.value < 32 and mc.value < 128
        paths, modes = (DisplayPath * pc.value)(), (Mode * mc.value)()
        result = api.QueryDisplayConfig(2, C.byref(pc), paths, C.byref(mc), modes, None)
        if result == 0:
            break
        assert result == 122
    else:
        raise RuntimeError('Display configuration changed repeatedly.')
    result = []
    for path in paths[:pc.value]:
        source, se = query(SourceName, 1, path.source.adapter, path.source.id)
        target, te = query(TargetName, 2, path.target.adapter, path.target.id)
        color, ce = query(Color, 9, path.target.adapter, path.target.id)
        white, we = query(White, 11, path.target.adapter, path.target.id)
        assert se == 0 and te == 0 and ce == 0
        record = {
            'source': source.name, 'name': target.name,
            'refreshHz': path.target.rate.n / path.target.rate.d if path.target.rate.d else None,
            'advancedColorSupported': bool(color.flags & 1),
            'advancedColorEnabled': bool(color.flags & 2),
            'wideColorEnforced': bool(color.flags & 4),
            'advancedColorForceDisabled': bool(color.flags & 8),
            'bitsPerColorChannel': color.bits, 'colorEncoding': color.encoding,
            'sdrWhiteNits': white.level / 1000 * 80 if we == 0 else None,
        }
        if path.source.mode < mc.value and modes[path.source.mode].type == 1:
            mode = modes[path.source.mode].data.source
            record['mode'] = {'width': mode.width, 'height': mode.height,
                              'x': mode.position.x, 'y': mode.position.y}
        result.append((record, path.target))
    return result


def selected(name):
    matches = [item for item in displays() if item[0]['name'] == name]
    assert len(matches) == 1, 'Expected exactly one matching active display.'
    return matches[0]


def set_enabled(name, enabled):
    record, target = selected(name)
    assert record['advancedColorSupported'] and not record['advancedColorForceDisabled']
    state = ColorState(Header(10, C.sizeof(ColorState), target.adapter, target.id), int(enabled))
    code = api.DisplayConfigSetDeviceInfo(C.byref(state.header))
    if code:
        raise RuntimeError(f'Changing the selected display state failed ({code}).')
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        record, _ = selected(name)
        if record['advancedColorEnabled'] == enabled:
            return record
        time.sleep(0.2)
    raise RuntimeError('The selected display did not reach the requested state.')


def hdr_check(name):
    CACHE.mkdir(parents=True, exist_ok=True)
    before = [record for record, _ in displays()]
    original, _ = selected(name)
    checkpoint = CACHE / 'hdr-restore-state.json'
    state = {'display': name, 'originalEnabled': original['advancedColorEnabled'],
             'before': before, 'restorePending': True}
    checkpoint.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
    previous = HERE / 'renderer-contract.json'
    environment = dict(os.environ)
    environment['KISAKI_HDR_PROBE_SHOW'] = '1'
    failure = None
    active = None
    try:
        baseline = subprocess.run([sys.executable, str(HERE / 'run-renderer.py')],
            cwd=ROOT, env=environment, capture_output=True, text=True, timeout=40,
            creationflags=subprocess.CREATE_NO_WINDOW)
        if baseline.returncode:
            raise RuntimeError(f'SDR renderer check failed ({baseline.returncode}).\n{baseline.stderr}')
        shutil.copy2(previous, HERE / 'renderer-sdr-contract.json')
        active = set_enabled(name, True)
        time.sleep(1)
        result = subprocess.run([sys.executable, str(HERE / 'run-renderer.py')],
            cwd=ROOT, env=environment, capture_output=True, text=True, timeout=40,
            creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode:
            raise RuntimeError(f'HDR renderer check failed ({result.returncode}).\n{result.stderr}')
    except Exception as error:
        failure = error
    finally:
        restored = set_enabled(name, original['advancedColorEnabled'])
        state['restorePending'] = False
        state['restored'] = restored
        checkpoint.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
    after = [record for record, _ in displays()]
    assert after == before, 'Display state differs after restoration.'
    receipt = {'checkedAt': datetime.now(timezone.utc).isoformat(),
               'before': before, 'testedDisplay': name, 'active': active,
               'after': after, 'originalStateRestored': True,
               'sourceSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    (HERE / 'display-contract.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    if failure:
        raise failure
    renderer = json.loads((HERE / 'renderer-contract.json').read_text(encoding='utf-8'))
    print(json.dumps({'display': name, 'active': active,
                     'rendererCapabilities': renderer['capabilities'],
                     'originalStateRestored': True, 'after': after}))


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--hdr-test':
        hdr_check(sys.argv[2])
    else:
        assert len(sys.argv) == 1
        print(json.dumps({'displays': [record for record, _ in displays()]}))
