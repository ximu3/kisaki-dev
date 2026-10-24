"""Check process-handle semantics using a child owned by this probe."""

import ctypes
import json
import platform
import subprocess
import sys
from ctypes import wintypes
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SYNCHRONIZE = 0x00100000
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
WAIT_OBJECT_0 = 0
WAIT_TIMEOUT = 258
ERROR_ACCESS_DENIED = 5


def main():
    if sys.platform != "win32":
        raise RuntimeError("This probe requires Windows.")

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.QueryFullProcessImageNameW.argtypes = [
        wintypes.HANDLE,
        wintypes.DWORD,
        wintypes.LPWSTR,
        ctypes.POINTER(wintypes.DWORD),
    ]
    kernel.QueryFullProcessImageNameW.restype = wintypes.BOOL
    kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
    kernel.WaitForSingleObject.restype = wintypes.DWORD
    kernel.GetExitCodeProcess.argtypes = [
        wintypes.HANDLE,
        ctypes.POINTER(wintypes.DWORD),
    ]
    kernel.GetExitCodeProcess.restype = wintypes.BOOL
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.CloseHandle.restype = wintypes.BOOL

    child = subprocess.Popen(
        [sys.executable, "-c", "import sys; sys.stdin.buffer.read(1); sys.exit(7)"],
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    handles = []
    try:
        restricted = kernel.OpenProcess(SYNCHRONIZE, False, child.pid)
        if not restricted:
            raise RuntimeError("Could not open the owned child for observation.")
        handles.append(restricted)
        if kernel.WaitForSingleObject(restricted, 0) != WAIT_TIMEOUT:
            raise RuntimeError("The owned child was not running at the first observation.")

        path_buffer = ctypes.create_unicode_buffer(32768)
        path_size = wintypes.DWORD(len(path_buffer))
        ctypes.set_last_error(0)
        path_read = kernel.QueryFullProcessImageNameW(
            restricted, 0, path_buffer, ctypes.byref(path_size)
        )
        path_error = ctypes.get_last_error()
        if path_read or path_error != ERROR_ACCESS_DENIED:
            raise RuntimeError("The restricted handle did not demonstrate denied path access.")

        readable = kernel.OpenProcess(
            SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION, False, child.pid
        )
        if not readable:
            raise RuntimeError("Could not open the owned child with limited query access.")
        handles.append(readable)
        path_size = wintypes.DWORD(len(path_buffer))
        if not kernel.QueryFullProcessImageNameW(
            readable, 0, path_buffer, ctypes.byref(path_size)
        ):
            raise RuntimeError("Could not read the executable path with limited query access.")
        executable_name = Path(path_buffer.value).name
        if not executable_name:
            raise RuntimeError("The observed executable name was empty.")

        child.stdin.write(b"x")
        child.stdin.flush()
        child.stdin.close()
        if child.wait(timeout=10) != 7:
            raise RuntimeError("The owned child did not complete its requested exit.")
        if kernel.WaitForSingleObject(restricted, 0) != WAIT_OBJECT_0:
            raise RuntimeError("The original handle did not observe the child exit.")
        exit_code = wintypes.DWORD()
        if not kernel.GetExitCodeProcess(readable, ctypes.byref(exit_code)):
            raise RuntimeError("The original query handle was not readable after exit.")
        if exit_code.value != 7:
            raise RuntimeError("The original handle reported an unexpected exit code.")

        result = {
            "purpose": "owned-child Windows process access and lifetime evidence",
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "system": platform.system(),
            "machine": platform.machine(),
            "pythonVersion": platform.python_version(),
            "checks": {
                "processKnownAliveWithObservationHandle": True,
                "sameLiveProcessPathDeniedWithoutQueryRight": True,
                "pathReadWithLimitedQueryRight": True,
                "executableName": executable_name,
                "originalHandleObservedExit": True,
                "originalQueryHandleReadableAfterExit": True,
                "exitCode": exit_code.value,
            },
            "nativeAddonBuilt": False,
            "vantageApiExecuted": False,
            "pidReuseExercised": False,
            "windowBackendExecuted": False,
            "captureExecuted": False,
            "externalTargetsReadOrControlled": False,
            "forcedTerminationExecuted": False,
        }
    finally:
        if child.poll() is None:
            if child.stdin is not None and not child.stdin.closed:
                child.stdin.close()
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait(timeout=10)
        close_failures = 0
        for handle in reversed(handles):
            if not kernel.CloseHandle(handle):
                close_failures += 1
        if close_failures:
            raise RuntimeError("An owned native process handle could not be closed.")

    result["nativeHandlesClosed"] = len(handles)
    output = ROOT / "windows-process.json"
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ownedChildChecks": "passed", "vantageApiExecuted": False}))


if __name__ == "__main__":
    main()
