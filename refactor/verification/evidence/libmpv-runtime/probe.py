"""Check core ownership while one fixed library stays loaded in a bounded child."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import ctypes as C
import hashlib
import json
import os
import platform
import re
import subprocess
import sys
import threading

HERE = Path(__file__).resolve().parent
BUILD = HERE / '../libmpv-upstream-fix/patched-build.json'
DEPENDENCIES = HERE / '../libmpv-upstream-fix/dependencies.json'
digest = lambda file: hashlib.sha256(Path(file).read_bytes()).hexdigest()
runtime_references = []


def execute():
    build = json.loads(BUILD.read_text(encoding='utf-8'))
    dependencies = json.loads(DEPENDENCIES.read_text(encoding='utf-8'))
    dll = Path(build['dll']['path'])
    assert digest(dll) == build['dll']['sha256']
    for name, info in dependencies['runtimeDlls'].items():
        assert digest(dll.parent / name) == info['sha256'], name
    source = dll.parents[2] / 'mpv-patched/include/mpv/client.h'
    header = source.read_text(encoding='utf-8')
    formats = {name: int(value) for name, value in re.findall(r'\b(MPV_FORMAT_\w+)\s*=\s*(\d+)', header)}
    directory = os.add_dll_directory(str(dll.parent))
    library = C.CDLL(str(dll), winmode=0x1100)
    runtime_references.extend([directory, library])
    signatures = {
        'mpv_client_api_version': (C.c_ulong, []),
        'mpv_create': (C.c_void_p, []),
        'mpv_initialize': (C.c_int, [C.c_void_p]),
        'mpv_set_option_string': (C.c_int, [C.c_void_p, C.c_char_p, C.c_char_p]),
        'mpv_set_property': (C.c_int, [C.c_void_p, C.c_char_p, C.c_int, C.c_void_p]),
        'mpv_get_property': (C.c_int, [C.c_void_p, C.c_char_p, C.c_int, C.c_void_p]),
        'mpv_create_weak_client': (C.c_void_p, [C.c_void_p, C.c_char_p]),
        'mpv_destroy': (None, [C.c_void_p]),
        'mpv_terminate_destroy': (None, [C.c_void_p]),
    }
    for name, (result, arguments) in signatures.items():
        function = getattr(library, name)
        function.restype, function.argtypes = result, arguments

    def check(status):
        assert status >= 0, status

    def create(volume):
        core = library.mpv_create()
        assert core
        try:
            for name, value in [('config', 'no'), ('load-scripts', 'no'), ('terminal', 'no'),
                                ('ao', 'null'), ('vo', 'null'), ('idle', 'yes'), ('volume', str(volume))]:
                check(library.mpv_set_option_string(core, name.encode(), value.encode()))
            check(library.mpv_initialize(core))
            return core
        except BaseException:
            library.mpv_terminate_destroy(core)
            raise

    def read_volume(core):
        value = C.c_double()
        check(library.mpv_get_property(core, b'volume', formats['MPV_FORMAT_DOUBLE'], C.byref(value)))
        return value.value

    keeper = create(31)
    ready = threading.Barrier(2, timeout=5)
    first_closed = threading.Event()

    def first():
        core = create(47)
        try:
            assert read_volume(core) == 47
            ready.wait()
        finally:
            library.mpv_terminate_destroy(core)
            first_closed.set()

    def second():
        core = create(83)
        try:
            ready.wait()
            assert first_closed.wait(5)
            assert read_volume(core) == 83
        finally:
            library.mpv_terminate_destroy(core)

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            jobs = [executor.submit(first), executor.submit(second)]
            for job in jobs:
                job.result()
        client = library.mpv_create_weak_client(keeper, b'owned-client')
        assert client
        try:
            value = C.c_double(59)
            check(library.mpv_set_property(client, b'volume', formats['MPV_FORMAT_DOUBLE'], C.byref(value)))
            assert read_volume(keeper) == 59
        finally:
            library.mpv_destroy(client)
        for volume in [17, 91]:
            core = create(volume)
            try:
                assert read_volume(core) == volume and read_volume(keeper) == 59
            finally:
                library.mpv_terminate_destroy(core)
        assert read_volume(keeper) == 59
    finally:
        library.mpv_terminate_destroy(keeper)
    # The CDLL and its directory reference remain owned until this process exits.
    assert runtime_references == [directory, library]
    version = library.mpv_client_api_version()
    return {
        'libraryLoads': 1, 'explicitLibraryUnloads': 0, 'coresCreatedAndClosed': 5,
        'concurrentCoreIsolation': True, 'survivingCoreAfterPeerClose': True,
        'weakClientSharesOnlyItsCore': True, 'repeatedCreationWithResidentLibrary': True,
        'sourceCommit': build['sourceCommit'], 'dllSha256': build['dll']['sha256'],
        'runtimeDllCount': len(dependencies['runtimeDlls']), 'clientHeaderSha256': digest(source),
        'apiVersion': {'major': version >> 16, 'minor': version & 65535},
        'nodeAddonExecuted': False, 'nodeWorkerExitExecuted': False, 'graphicsExecuted': False,
        'historicalReloadFailureDiagnosed': False, 'releaseBuildVerified': False,
    }


if '--child' in sys.argv:
    print(json.dumps(execute()))
else:
    process = subprocess.run([sys.executable, __file__, '--child'], capture_output=True,
                             text=True, timeout=30, creationflags=subprocess.CREATE_NO_WINDOW)
    if process.returncode:
        raise RuntimeError(f'Owned runtime probe failed ({process.returncode}): {process.stderr}')
    result = json.loads(process.stdout)
    receipt = {'checkedAt': datetime.now(timezone.utc).isoformat(),
               'host': {'system': platform.system(), 'version': platform.version(), 'machine': platform.machine()},
               'probeSha256': digest(__file__), 'buildReceiptSha256': digest(BUILD),
               'dependenciesReceiptSha256': digest(DEPENDENCIES), 'childExitCode': process.returncode,
               **result}
    (HERE / 'runtime-contract.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'libraryLoads': result['libraryLoads'], 'coresClosed': result['coresCreatedAndClosed'],
                      'concurrentCoreIsolation': result['concurrentCoreIsolation']}))
