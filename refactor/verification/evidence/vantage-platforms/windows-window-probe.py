"""Exercise painting primitives against hidden windows owned by this probe."""

import ctypes
import hashlib
import json
import os
import queue
import subprocess
import sys
import threading
import uuid
from ctypes import wintypes
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WIDTH = 160
HEIGHT = 100
WM_PRINT = 0x0317
WM_PRINTCLIENT = 0x0318
WM_QUIT = 0x0012
NO_WINDOW = 0x08000000
LRESULT = ctypes.c_ssize_t
WNDPROC = ctypes.WINFUNCTYPE(
    LRESULT, wintypes.HWND, wintypes.UINT, ctypes.c_size_t, ctypes.c_ssize_t
)


class WNDCLASS(ctypes.Structure):
    _fields_ = [
        ("style", wintypes.UINT),
        ("lpfnWndProc", WNDPROC),
        ("cbClsExtra", ctypes.c_int),
        ("cbWndExtra", ctypes.c_int),
        ("hInstance", wintypes.HINSTANCE),
        ("hIcon", wintypes.HICON),
        ("hCursor", wintypes.HANDLE),
        ("hbrBackground", wintypes.HBRUSH),
        ("lpszMenuName", wintypes.LPCWSTR),
        ("lpszClassName", wintypes.LPCWSTR),
    ]


class BITMAPINFOHEADER(ctypes.Structure):
    _fields_ = [
        ("biSize", wintypes.DWORD),
        ("biWidth", wintypes.LONG),
        ("biHeight", wintypes.LONG),
        ("biPlanes", wintypes.WORD),
        ("biBitCount", wintypes.WORD),
        ("biCompression", wintypes.DWORD),
        ("biSizeImage", wintypes.DWORD),
        ("biXPelsPerMeter", wintypes.LONG),
        ("biYPelsPerMeter", wintypes.LONG),
        ("biClrUsed", wintypes.DWORD),
        ("biClrImportant", wintypes.DWORD),
    ]


class BITMAPINFO(ctypes.Structure):
    _fields_ = [("bmiHeader", BITMAPINFOHEADER), ("bmiColors", wintypes.DWORD * 3)]


def native():
    user = ctypes.WinDLL("user32", use_last_error=True)
    gdi = ctypes.WinDLL("gdi32", use_last_error=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    declarations = [
        (user, "DefWindowProcW", LRESULT, [wintypes.HWND, wintypes.UINT, ctypes.c_size_t, ctypes.c_ssize_t]),
        (user, "RegisterClassW", wintypes.WORD, [ctypes.POINTER(WNDCLASS)]),
        (user, "UnregisterClassW", wintypes.BOOL, [wintypes.LPCWSTR, wintypes.HINSTANCE]),
        (user, "CreateWindowExW", wintypes.HWND, [wintypes.DWORD, wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.DWORD, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.HWND, wintypes.HMENU, wintypes.HINSTANCE, wintypes.LPVOID]),
        (user, "DestroyWindow", wintypes.BOOL, [wintypes.HWND]),
        (user, "GetMessageW", wintypes.BOOL, [ctypes.POINTER(wintypes.MSG), wintypes.HWND, wintypes.UINT, wintypes.UINT]),
        (user, "TranslateMessage", wintypes.BOOL, [ctypes.POINTER(wintypes.MSG)]),
        (user, "DispatchMessageW", LRESULT, [ctypes.POINTER(wintypes.MSG)]),
        (user, "PostThreadMessageW", wintypes.BOOL, [wintypes.DWORD, wintypes.UINT, ctypes.c_size_t, ctypes.c_ssize_t]),
        (user, "GetWindowThreadProcessId", wintypes.DWORD, [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]),
        (user, "GetWindowRect", wintypes.BOOL, [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]),
        (user, "PrintWindow", wintypes.BOOL, [wintypes.HWND, wintypes.HDC, wintypes.UINT]),
        (user, "SendMessageW", LRESULT, [wintypes.HWND, wintypes.UINT, ctypes.c_size_t, ctypes.c_ssize_t]),
        (user, "FillRect", ctypes.c_int, [wintypes.HDC, ctypes.POINTER(wintypes.RECT), wintypes.HBRUSH]),
        (gdi, "CreateSolidBrush", wintypes.HBRUSH, [wintypes.DWORD]),
        (gdi, "CreateCompatibleDC", wintypes.HDC, [wintypes.HDC]),
        (gdi, "CreateDIBSection", wintypes.HBITMAP, [wintypes.HDC, ctypes.POINTER(BITMAPINFO), wintypes.UINT, ctypes.POINTER(wintypes.LPVOID), wintypes.HANDLE, wintypes.DWORD]),
        (gdi, "SelectObject", wintypes.HANDLE, [wintypes.HDC, wintypes.HANDLE]),
        (gdi, "DeleteObject", wintypes.BOOL, [wintypes.HANDLE]),
        (gdi, "DeleteDC", wintypes.BOOL, [wintypes.HDC]),
        (gdi, "GdiFlush", wintypes.BOOL, []),
        (kernel, "GetModuleHandleW", wintypes.HINSTANCE, [wintypes.LPCWSTR]),
        (kernel, "GetCurrentThreadId", wintypes.DWORD, []),
    ]
    for module, name, result, arguments in declarations:
        function = getattr(module, name)
        function.restype = result
        function.argtypes = arguments
    return user, gdi, kernel


def emit(value):
    print(json.dumps(value), flush=True)


def owner(block):
    user, gdi, kernel = native()
    class_name = "VantageDesignProbe" + uuid.uuid4().hex
    instance = kernel.GetModuleHandleW(None)

    @WNDPROC
    def procedure(window, message, wparam, lparam):
        if message in (WM_PRINT, WM_PRINTCLIENT):
            emit({"event": "print-entered"})
            if block:
                threading.Event().wait()
            regions = [
                (0, 0, WIDTH // 2, HEIGHT // 2, 0x000000FF),
                (WIDTH // 2, 0, WIDTH, HEIGHT // 2, 0x0000FF00),
                (0, HEIGHT // 2, WIDTH // 2, HEIGHT, 0x00FF0000),
                (WIDTH // 2, HEIGHT // 2, WIDTH, HEIGHT, 0x00FFFFFF),
            ]
            for left, top, right, bottom, color in regions:
                brush = gdi.CreateSolidBrush(color)
                rectangle = wintypes.RECT(left, top, right, bottom)
                user.FillRect(wparam, ctypes.byref(rectangle), brush)
                gdi.DeleteObject(brush)
            gdi.GdiFlush()
            return 0
        return user.DefWindowProcW(window, message, wparam, lparam)

    window_class = WNDCLASS()
    window_class.lpfnWndProc = procedure
    window_class.hInstance = instance
    window_class.lpszClassName = class_name
    if not user.RegisterClassW(ctypes.byref(window_class)):
        raise RuntimeError("The owned test window class could not be registered.")
    window = user.CreateWindowExW(
        0, class_name, "Vantage design probe", 0x80000000,
        0, 0, WIDTH, HEIGHT, None, None, instance, None,
    )
    if not window:
        raise RuntimeError("The hidden test window could not be created.")
    thread_id = kernel.GetCurrentThreadId()

    def stop_when_requested():
        sys.stdin.buffer.read(1)
        user.PostThreadMessageW(thread_id, WM_QUIT, 0, 0)

    threading.Thread(target=stop_when_requested, daemon=True).start()
    emit({"event": "ready", "window": int(window), "pid": os.getpid()})
    try:
        message = wintypes.MSG()
        while True:
            received = user.GetMessageW(ctypes.byref(message), None, 0, 0)
            if received == 0:
                break
            if received == -1:
                raise RuntimeError("The owned window message loop failed.")
            user.TranslateMessage(ctypes.byref(message))
            user.DispatchMessageW(ctypes.byref(message))
    finally:
        user.DestroyWindow(window)
        user.UnregisterClassW(class_name, instance)


def capture(window, expected_pid, method):
    user, gdi, _ = native()
    actual_pid = wintypes.DWORD()
    user.GetWindowThreadProcessId(window, ctypes.byref(actual_pid))
    if actual_pid.value != expected_pid:
        raise RuntimeError("The capture target does not belong to the owned test process.")
    rectangle = wintypes.RECT()
    if not user.GetWindowRect(window, ctypes.byref(rectangle)):
        raise RuntimeError("The owned window bounds could not be read.")
    width = rectangle.right - rectangle.left
    height = rectangle.bottom - rectangle.top
    if (width, height) != (WIDTH, HEIGHT):
        raise RuntimeError("The owned fixture has unexpected dimensions.")
    information = BITMAPINFO()
    information.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    information.bmiHeader.biWidth = width
    information.bmiHeader.biHeight = -height
    information.bmiHeader.biPlanes = 1
    information.bmiHeader.biBitCount = 32
    bits = wintypes.LPVOID()
    bitmap = gdi.CreateDIBSection(None, ctypes.byref(information), 0, ctypes.byref(bits), None, 0)
    dc = gdi.CreateCompatibleDC(None)
    if not bitmap or not dc or not bits.value:
        raise RuntimeError("The owned capture buffer could not be created.")
    previous = gdi.SelectObject(dc, bitmap)
    try:
        ctypes.memset(bits.value, 0x6D, width * height * 4)
        if method == "print-window":
            native_result = bool(user.PrintWindow(window, dc, 0))
        elif method == "paint-message":
            native_result = user.SendMessageW(window, WM_PRINT, dc, 0x1E)
        else:
            raise RuntimeError("Unknown capture primitive.")
        gdi.GdiFlush()
        pixels = ctypes.string_at(bits.value, width * height * 4)
        samples = []
        for x, y in [(10, 10), (width - 10, 10), (10, height - 10), (width - 10, height - 10)]:
            start = (y * width + x) * 4
            blue, green, red, alpha = pixels[start:start + 4]
            samples.append({"rgb": [red, green, blue], "alphaByte": alpha})
        matches_fixture = [sample["rgb"] for sample in samples] == [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255]]
    finally:
        gdi.SelectObject(dc, previous)
        if not gdi.DeleteObject(bitmap) or not gdi.DeleteDC(dc):
            raise RuntimeError("An owned capture resource could not be released.")
    emit({"method": method, "nativeResult": native_result, "matchesFixture": matches_fixture, "width": width, "height": height, "samples": samples, "sha256": hashlib.sha256(pixels).hexdigest(), "resourcesReleased": True})


def run_case(block, method):
    window_process = subprocess.Popen(
        [sys.executable, __file__, "owner", "block" if block else "paint"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, creationflags=NO_WINDOW,
    )
    messages = queue.Queue()

    def collect():
        for line in window_process.stdout:
            messages.put(json.loads(line))

    collector = threading.Thread(target=collect, daemon=True)
    collector.start()
    worker = None
    try:
        ready = messages.get(timeout=10)
        if ready["event"] != "ready" or ready["pid"] != window_process.pid:
            raise RuntimeError("The owned window did not report a valid ready state.")
        worker = subprocess.Popen(
            [sys.executable, __file__, "capture", str(ready["window"]), str(window_process.pid), method],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            creationflags=NO_WINDOW,
        )
        if block:
            entered = messages.get(timeout=10)
            if entered["event"] != "print-entered":
                raise RuntimeError("The owned window did not receive the print request.")
            try:
                worker.communicate(timeout=0.5)
            except subprocess.TimeoutExpired:
                worker.kill()
                worker.communicate(timeout=10)
                result = {"method": method, "paintCallbackObserved": True, "exceededObservationMs": 500, "ownedCaptureWorkerTerminated": True}
            else:
                raise RuntimeError("The deliberately blocked print request returned unexpectedly.")
        else:
            output, errors = worker.communicate(timeout=10)
            if worker.returncode != 0:
                raise RuntimeError("The owned capture worker failed.") from RuntimeError(errors)
            result = json.loads(output)
    finally:
        if worker is not None and worker.poll() is None:
            worker.kill()
            worker.communicate(timeout=10)
        window_process.stdin.close()
        if block and window_process.poll() is None:
            window_process.kill()
        try:
            window_process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            window_process.kill()
            window_process.wait(timeout=10)
        collector.join(timeout=2)
        window_process.stdout.close()
        window_process.stderr.close()
    if not block:
        events = []
        while not messages.empty():
            events.append(messages.get_nowait())
        result["paintCallbackObserved"] = any(event["event"] == "print-entered" for event in events)
    return result


def main():
    if sys.platform != "win32":
        raise RuntimeError("This probe requires Windows.")
    if len(sys.argv) > 1:
        if sys.argv[1] == "owner":
            owner(sys.argv[2] == "block")
        elif sys.argv[1] == "capture":
            capture(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
        else:
            raise RuntimeError("Unknown probe mode.")
        return
    result = {
        "purpose": "hidden owned-window painting primitives, not a Vantage capture backend",
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "printWindowCase": run_case(False, "print-window"),
        "paintProtocolCase": run_case(False, "paint-message"),
        "blockedProtocolCase": run_case(True, "paint-message"),
        "windowsShown": False,
        "externalTargetsReadOrControlled": False,
        "windowsGraphicsCaptureExecuted": False,
        "gpuContentVerified": False,
        "hdrVerified": False,
        "handleReuseVerified": False,
        "vantageApiExecuted": False,
        "ownedProcessesCleanedUp": True,
    }
    (ROOT / "windows-window.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    emit({"printWindowFixtureMatch": result["printWindowCase"]["matchesFixture"], "paintProtocolFixtureMatch": result["paintProtocolCase"]["matchesFixture"], "blockingObserved": True, "vantageApiExecuted": False})


if __name__ == "__main__":
    main()
