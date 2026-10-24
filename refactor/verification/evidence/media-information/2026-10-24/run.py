import ctypes as C
import json
import os
import platform
import statistics
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from fixtures import generate
from native import Runtime

REPOSITORY = Path(__file__).resolve().parents[5]
EVIDENCE = Path(__file__).resolve().parent
WORK = REPOSITORY / '.cache' / 'media-information'
PROPERTIES = ['duration', 'file-format', 'track-list', 'chapter-list', 'metadata', 'video-params', 'pause', 'time-pos', 'current-vo', 'current-ao']


def load(core, source: str):
    """Wait for FILE_LOADED or an actual load failure, recording native event order."""
    core.command('loadfile', source, 'replace')
    events = []
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        event = core.event()
        if event['kind']:
            events.append(event)
        if event['kind'] == 8:
            return {'loaded': True, 'events': events}
        if event['kind'] == 7:
            return {'loaded': False, 'events': events, 'failure': event}
    raise TimeoutError('File readiness exceeded the probe deadline')


def inspect(runtime, source: Path, decode_video: bool):
    """Read a file in its own paused core and include initialization and close costs."""
    started = time.perf_counter()
    core = runtime.create(decode_video=decode_video)
    initialized = time.perf_counter()
    try:
        outcome = load(core, str(source))
        values = {name: core.get(name) for name in PROPERTIES} if outcome['loaded'] else {}
        readable = time.perf_counter()
        return_value = {
            'file': source.name, 'decodeVideo': decode_video, **outcome, 'values': values,
            'initializeMs': (initialized - started) * 1000,
            'readMs': (readable - initialized) * 1000,
        }
    finally:
        closing = time.perf_counter()
        core.close()
        closed = time.perf_counter()

    return_value.update({'closeMs': (closed - closing) * 1000, 'totalMs': (closed - started) * 1000})
    return return_value


def inspect_preloaded(runtime, source: Path):
    """Read container facts at the preloaded hook, then stop before selecting tracks."""
    started = time.perf_counter()
    core = runtime.create(decode_video=False)
    core.add_preloaded_hook()
    values = None
    events = []
    try:
        core.command('loadfile', str(source), 'replace')
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            event = core.event()
            if event['kind']:
                events.append(event)
            if event['kind'] == 25:
                values = {name: core.get(name) for name in PROPERTIES}
                core.command('stop')
                core.continue_hook(event['hookId'])
            if event['kind'] == 7:
                return_value = {'file': source.name, 'read': values is not None, 'values': values, 'events': events, 'end': event}
                break
        else:
            raise TimeoutError('The metadata read did not finish')
    finally:
        core.close()

    return_value['totalMs'] = (time.perf_counter() - started) * 1000
    return return_value


def validate_information(case):
    values = case['values']
    assert 1.9 <= values['duration'] <= 2.1, case['file']
    tracks = values['track-list']
    assert all(not track['selected'] and not track['external'] for track in tracks)
    assert values['current-vo'] == {'unavailable': -10}
    assert values['current-ao'] == {'unavailable': -10}
    assert case['end']['reason'] == 2 and case['end']['fileError'] == 0

    video = [track for track in tracks if track['type'] == 'video']
    if video:
        assert video[0]['demux-w'] == 160 and video[0]['demux-h'] == 90
        assert abs(video[0]['demux-fps'] - 24) < 0.001

    if case['file'] in ['多轨道 🎬.mkv', 'multi-track.mp4']:
        assert [track['type'] for track in tracks] == ['video', 'audio', 'audio', 'sub']
        assert [track.get('lang') for track in tracks[1:]] == ['jpn', 'eng', 'zho']
        assert [chapter['time'] for chapter in values['chapter-list']] == [0, 1]
        assert video[0]['codec'] == 'h264'
    elif case['file'] == 'sample.webm':
        assert [track['codec'] for track in tracks] == ['vp9', 'opus']
    elif case['file'] == 'hevc-10bit.mkv':
        assert [track['codec'] for track in tracks] == ['hevc', 'flac']
    elif case['file'] == 'sample.ts':
        assert [track['codec'] for track in tracks] == ['h264', 'aac']
    else:
        assert [track['codec'] for track in tracks] == ['pcm_s16le']


def handle_count():
    count = C.c_ulong()
    kernel = C.WinDLL('kernel32', use_last_error=True)
    kernel.GetCurrentProcess.restype = C.c_void_p
    kernel.GetProcessHandleCount.argtypes = [C.c_void_p, C.POINTER(C.c_ulong)]
    if not kernel.GetProcessHandleCount(kernel.GetCurrentProcess(), C.byref(count)):
        raise C.WinError(C.get_last_error())
    return count.value


def cancellation(runtime):
    """Interrupt a load blocked on a loopback HTTP body, then read a valid local file."""
    connected = threading.Event()
    release = threading.Event()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header('Content-Type', 'video/mp4')
            self.send_header('Transfer-Encoding', 'chunked')
            self.end_headers()
            self.wfile.flush()
            connected.set()
            release.wait(10)

        def log_message(self, *_arguments):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    core = runtime.create(decode_video=True)
    try:
        core.command('loadfile', f'http://127.0.0.1:{server.server_port}/held.mp4', 'replace')
        if not connected.wait(3):
            raise TimeoutError('The probe did not reach the controlled HTTP input')

        started = time.perf_counter()
        core.command('stop')
        deadline = time.monotonic() + 3
        result = {'completed': False}
        while time.monotonic() < deadline:
            event = core.event()
            if event['kind'] == 7:
                result = {'completed': True, 'elapsedMs': (time.perf_counter() - started) * 1000, 'event': event}
                break

        release.set()
        result['recovery'] = load(core, str(WORK / 'fixtures' / 'silent.wav'))
        return result
    finally:
        release.set()
        core.close()
        server.shutdown()
        server.server_close()
        thread.join()


def execute():
    input_receipt = json.loads((REPOSITORY / 'refactor/verification/evidence/contract-closure/2026-10-22/screenshot-build.json').read_text(encoding='utf-8'))
    runtime = Runtime(Path(input_receipt['dll']), input_receipt['dllSha256'])
    fixtures = generate(WORK / 'fixtures')
    files = ['多轨道 🎬.mkv', 'multi-track.mp4', 'sample.webm', 'silent.wav', 'hevc-10bit.mkv', 'sample.ts', 'invalid.bin', 'truncated.mp4', 'missing.mp4']

    cases = []
    for decode_video in [False, True]:
        for filename in files:
            cases.append(inspect(runtime, WORK / 'fixtures' / filename, decode_video))

    preloaded = [inspect_preloaded(runtime, WORK / 'fixtures' / filename) for filename in files]
    for case in preloaded[:6]:
        assert case['read']
        validate_information(case)
    for case in preloaded[6:]:
        assert not case['read'] and case['end']['reason'] == 4

    # Warm process-wide runtime state before measuring repeated core creation and disposal.
    for _index in range(5):
        inspect_preloaded(runtime, WORK / 'fixtures' / 'multi-track.mp4')
    handles = [{'iteration': 0, 'count': handle_count()}]
    batch = []
    for index in range(100):
        case = inspect_preloaded(runtime, WORK / 'fixtures' / files[index % 6])
        validate_information(case)
        batch.append(case['totalMs'])
        if (index + 1) % 10 == 0:
            handles.append({'iteration': index + 1, 'count': handle_count()})

    # A separate metadata reader must leave the retained playback core on its original file.
    retained = runtime.create(decode_video=True, paused=False)
    try:
        initial = load(retained, str(WORK / 'fixtures' / 'multi-track.mp4'))
        time.sleep(0.1)
        before_time = retained.get('time-pos')
        before = {name: retained.get(name) for name in ['path', 'pause', 'track-list']}
        inspect_preloaded(runtime, WORK / 'fixtures' / 'sample.webm')
        after = {name: retained.get(name) for name in before}
        after_time = retained.get('time-pos')
        isolation = {'loaded': initial['loaded'], 'unchanged': before == after, 'before': before, 'after': after, 'beforePosition': before_time, 'afterPosition': after_time}
        assert after_time >= before_time and after['pause'] is False
    finally:
        retained.close()

    cancelled = cancellation(runtime)
    assert isolation['unchanged']
    assert cancelled['completed'] and cancelled['event']['reason'] == 2
    assert cancelled['recovery']['loaded']
    assert handles[-1]['count'] <= handles[0]['count'] + 2
    ordered = sorted(batch)
    result = {
        'scope': 'Windows x64 libmpv C API capability check; libmpv-node is not implemented here',
        'os': platform.platform(), 'sourceCommit': input_receipt['sourceCommit'],
        'dllSha256': input_receipt['dllSha256'], 'fixtures': fixtures, 'cases': cases, 'preloaded': preloaded,
        'batch': {'count': len(batch), 'milliseconds': batch, 'medianMs': statistics.median(batch), 'p95Ms': ordered[94], 'maxMs': max(batch), 'processHandleCounts': handles},
        'retainedCoreIsolation': isolation, 'cancellation': cancelled,
    }
    (EVIDENCE / 'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'preloadedCases': len(preloaded), 'validInputs': sum(case['read'] for case in preloaded), 'batchP95Ms': ordered[94], 'handles': handles, 'isolation': isolation['unchanged'], 'cancellation': cancelled}, ensure_ascii=False))


if __name__ == '__main__':
    WORK.mkdir(parents=True, exist_ok=True)
    if '--worker' in sys.argv:
        execute()
    else:
        completed = subprocess.run([sys.executable, str(Path(__file__).resolve()), '--worker'], capture_output=True, text=True, encoding='utf-8', timeout=120, creationflags=subprocess.CREATE_NO_WINDOW)
        (EVIDENCE / 'run.log').write_text(completed.stdout + '\n' + completed.stderr, encoding='utf-8')
        print(completed.stdout)
        if completed.returncode:
            print(completed.stderr, file=sys.stderr)
        raise SystemExit(completed.returncode)
