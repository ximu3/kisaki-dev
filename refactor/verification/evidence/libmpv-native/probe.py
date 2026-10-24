"""Probe real C property and stream behavior in a bounded child process."""

import ctypes as C
import hashlib
import io
import json
import os
import platform
import re
import subprocess
import sys
import threading
import time
import wave
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def execute():
    binary = json.loads((ROOT / "binary-input.json").read_text(encoding="utf-8"))
    dll = Path(binary["dll"])
    if hashlib.sha256(dll.read_bytes()).hexdigest() != binary["dllSha256"]:
        raise RuntimeError("The prepared libmpv DLL has changed.")
    header = Path(binary["clientHeader"]).read_text(encoding="utf-8")
    constants = {name: int(value) for name, value in re.findall(
        r"\b(MPV_(?:FORMAT|EVENT|ERROR)_\w+)\s*=\s*(-?\d+)", header
    )}
    library = C.CDLL(str(dll), winmode=0x1100)

    class Node(C.Structure):
        pass

    class NodeList(C.Structure):
        pass

    class Bytes(C.Structure):
        _fields_ = [("data", C.c_void_p), ("size", C.c_size_t)]

    class NodeValue(C.Union):
        _fields_ = [
            ("string", C.c_char_p), ("flag", C.c_int), ("int64", C.c_int64),
            ("double", C.c_double), ("list", C.POINTER(NodeList)),
            ("bytes", C.POINTER(Bytes)),
        ]

    Node._fields_ = [("value", NodeValue), ("format", C.c_int)]
    NodeList._fields_ = [
        ("num", C.c_int), ("values", C.POINTER(Node)), ("keys", C.POINTER(C.c_char_p)),
    ]

    class Event(C.Structure):
        _fields_ = [
            ("id", C.c_int), ("error", C.c_int), ("userdata", C.c_uint64),
            ("data", C.c_void_p),
        ]

    class PropertyEvent(C.Structure):
        _fields_ = [("name", C.c_char_p), ("format", C.c_int), ("data", C.c_void_p)]

    read_type = C.CFUNCTYPE(C.c_int64, C.c_void_p, C.c_void_p, C.c_uint64)
    seek_type = C.CFUNCTYPE(C.c_int64, C.c_void_p, C.c_int64)
    size_type = C.CFUNCTYPE(C.c_int64, C.c_void_p)
    close_type = C.CFUNCTYPE(None, C.c_void_p)
    cancel_type = C.CFUNCTYPE(None, C.c_void_p)

    class StreamInfo(C.Structure):
        _fields_ = [
            ("cookie", C.c_void_p), ("read", read_type), ("seek", seek_type),
            ("size", size_type), ("close", close_type), ("cancel", cancel_type),
        ]

    open_type = C.CFUNCTYPE(C.c_int, C.c_void_p, C.c_char_p, C.POINTER(StreamInfo))

    signatures = {
        "mpv_client_api_version": (C.c_ulong, []),
        "mpv_create": (C.c_void_p, []),
        "mpv_initialize": (C.c_int, [C.c_void_p]),
        "mpv_set_option_string": (C.c_int, [C.c_void_p, C.c_char_p, C.c_char_p]),
        "mpv_set_property": (C.c_int, [C.c_void_p, C.c_char_p, C.c_int, C.c_void_p]),
        "mpv_get_property": (C.c_int, [C.c_void_p, C.c_char_p, C.c_int, C.c_void_p]),
        "mpv_observe_property": (C.c_int, [C.c_void_p, C.c_uint64, C.c_char_p, C.c_int]),
        "mpv_unobserve_property": (C.c_int, [C.c_void_p, C.c_uint64]),
        "mpv_command": (C.c_int, [C.c_void_p, C.POINTER(C.c_char_p)]),
        "mpv_wait_event": (C.POINTER(Event), [C.c_void_p, C.c_double]),
        "mpv_free": (None, [C.c_void_p]),
        "mpv_free_node_contents": (None, [C.POINTER(Node)]),
        "mpv_create_weak_client": (C.c_void_p, [C.c_void_p, C.c_char_p]),
        "mpv_destroy": (None, [C.c_void_p]),
        "mpv_terminate_destroy": (None, [C.c_void_p]),
        "mpv_stream_cb_add_ro": (C.c_int, [C.c_void_p, C.c_char_p, C.c_void_p, open_type]),
    }
    for name, (result, arguments) in signatures.items():
        function = getattr(library, name)
        function.restype, function.argtypes = result, arguments

    def fmt(name):
        return constants[f"MPV_FORMAT_{name}"]

    def success(result, operation):
        if result < 0:
            raise AssertionError(f"Native operation failed: {operation} ({result}).")
        return result

    def create():
        context = library.mpv_create()
        if not context:
            raise RuntimeError("The probe could not create a core.")
        try:
            for name, value in [
                ("config", "no"), ("terminal", "no"), ("load-scripts", "no"),
                ("idle", "yes"), ("pause", "yes"), ("volume", "80"),
                ("ao", "null"), ("vo", "null"), ("cache", "no"),
            ]:
                success(library.mpv_set_option_string(context, name.encode(), value.encode()), name)
            success(library.mpv_initialize(context), "initialize")
            return context
        except BaseException:
            library.mpv_terminate_destroy(context)
            raise

    def get(context, name, format_name):
        format_value = fmt(format_name)
        data_type = {
            "FLAG": C.c_int, "INT64": C.c_int64, "DOUBLE": C.c_double,
            "STRING": C.c_char_p, "OSD_STRING": C.c_char_p, "NODE": Node,
        }.get(format_name, C.c_int64)
        value = data_type()
        status = library.mpv_get_property(context, name.encode(), format_value, C.byref(value))
        if status < 0:
            return {"status": status}
        if format_name in ("STRING", "OSD_STRING"):
            result = value.value.decode("utf-8")
            library.mpv_free(C.cast(value, C.c_void_p))
        elif format_name == "NODE":
            try:
                result = {"format": value.format}
                if value.format == fmt("INT64"):
                    result["value"] = str(value.value.int64)
                elif value.format == fmt("FLAG"):
                    result["value"] = bool(value.value.flag)
                elif value.format == fmt("DOUBLE"):
                    result["value"] = value.value.double
            finally:
                library.mpv_free_node_contents(C.byref(value))
        elif format_name == "INT64":
            result = str(value.value)
        else:
            result = value.value
        return {"status": status, "value": result}

    def command(context, *arguments):
        values = (C.c_char_p * (len(arguments) + 1))(
            *[value.encode("utf-8") for value in arguments], None
        )
        return success(library.mpv_command(context, values), arguments[0])

    def wait(context, event_name, userdata=None, timeout=3):
        deadline = time.monotonic() + timeout
        expected = constants[f"MPV_EVENT_{event_name}"]
        while time.monotonic() < deadline:
            event = library.mpv_wait_event(context, 0.05).contents
            if event.id != expected or (userdata is not None and event.userdata != userdata):
                continue
            result = {"event": event.id, "error": event.error, "userdata": event.userdata}
            if event_name == "PROPERTY_CHANGE":
                prop = C.cast(event.data, C.POINTER(PropertyEvent)).contents
                result.update({"name": prop.name.decode(), "format": prop.format, "hasData": bool(prop.data)})
                if prop.data and prop.format == fmt("INT64"):
                    result["value"] = str(C.cast(prop.data, C.POINTER(C.c_int64))[0])
                elif prop.data and prop.format == fmt("STRING"):
                    result["value"] = C.cast(prop.data, C.POINTER(C.c_char_p))[0].decode("utf-8")
            return result
        raise AssertionError(f"Timed out waiting for {event_name}.")

    context = create()
    try:
        version = get(context, "mpv-version", "STRING")["value"]
        properties = {
            f"{name}:{format_name}": get(context, name, format_name)
            for name, format_name in [
                ("pause", "FLAG"), ("pause", "STRING"), ("pause", "OSD_STRING"),
                ("volume", "DOUBLE"), ("volume", "INT64"),
                ("volume", "NODE"), ("volume", "NONE"),
            ]
        }
        assert properties["pause:FLAG"]["value"] == 1
        assert properties["volume:DOUBLE"]["value"] == 80
        assert properties["volume:INT64"]["value"] == "80"
        assert properties["volume:NONE"]["status"] == constants["MPV_ERROR_PROPERTY_FORMAT"]
        integer = Node(NodeValue(int64=9007199254740993), fmt("INT64"))
        success(library.mpv_set_property(context, b"user-data/probe-int", fmt("NODE"), C.byref(integer)), "set node")
        properties["int64Node"] = get(context, "user-data/probe-int", "NODE")
        assert properties["int64Node"]["value"]["value"] == "9007199254740993"
        success(library.mpv_observe_property(context, 101, b"pause", fmt("NONE")), "observe invalidation")
        initial = wait(context, "PROPERTY_CHANGE", 101)
        assert initial["format"] == fmt("NONE") and not initial["hasData"]
        pause = C.c_int(0)
        success(library.mpv_set_property(context, b"pause", fmt("FLAG"), C.byref(pause)), "change pause")
        changed = wait(context, "PROPERTY_CHANGE", 101)
        assert changed["format"] == fmt("NONE") and not changed["hasData"]
        assert library.mpv_unobserve_property(context, 101) == 1
        success(library.mpv_observe_property(context, 103, b"volume", fmt("INT64")), "observe integer")
        observed_integer = wait(context, "PROPERTY_CHANGE", 103)
        assert observed_integer["value"] == "80"
        assert library.mpv_unobserve_property(context, 103) == 1
        success(library.mpv_observe_property(context, 104, b"pause", fmt("STRING")), "observe text")
        observed_text = wait(context, "PROPERTY_CHANGE", 104)
        assert observed_text["value"] == "no"
        assert library.mpv_unobserve_property(context, 104) == 1
        osd_observation = library.mpv_observe_property(context, 102, b"pause", fmt("OSD_STRING"))
        assert osd_observation == constants["MPV_ERROR_PROPERTY_FORMAT"]
    finally:
        library.mpv_terminate_destroy(context)

    first_core = second_core = None
    clients = []
    try:
        first_core = create()
        second_core = create()
        for name in (b"first-controller", b"second-controller"):
            client = library.mpv_create_weak_client(first_core, name)
            assert client
            clients.append(client)
        pause = C.c_int(0)
        success(library.mpv_set_property(clients[0], b"pause", fmt("FLAG"), C.byref(pause)), "client pause")
        shared_owner = get(first_core, "pause", "FLAG")["value"]
        shared_peer = get(clients[1], "pause", "FLAG")["value"]
        independent_before = get(second_core, "pause", "FLAG")["value"]
        assert shared_owner == shared_peer == 0 and independent_before == 1
        library.mpv_destroy(clients.pop(0))
        after_detach = get(clients[0], "pause", "FLAG")["value"]
        assert after_detach == 0
        command(clients[0], "quit")
        shutdown = wait(first_core, "SHUTDOWN")
        library.mpv_destroy(clients.pop())
        library.mpv_terminate_destroy(first_core)
        first_core = None
        independent_after = get(second_core, "pause", "FLAG")["value"]
        assert independent_after == 1
        client_model = {
            "ownerAndSiblingSharePause": True,
            "secondCoreRetainsIndependentPause": True,
            "peerRemainsUsableAfterClientDetach": True,
            "clientQuitReachesOwningCore": shutdown["event"] == constants["MPV_EVENT_SHUTDOWN"],
            "secondCoreRemainsUsableAfterFirstCoreDestroyed": True,
        }
    finally:
        for client in clients:
            library.mpv_destroy(client)
        for core in (first_core, second_core):
            if core:
                library.mpv_terminate_destroy(core)

    audio = io.BytesIO()
    with wave.open(audio, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(8000)
        output.writeframes(bytes(16000))
    payload = audio.getvalue()
    callback_failures = []
    streams = {}

    class Source:
        def __init__(self, mode):
            self.mode = mode
            self.position = 0
            self.open_started = threading.Event()
            self.read_started = threading.Event()
            self.release_open = threading.Event()
            self.seek_started = threading.Event()
            self.release_seek = threading.Event()
            self.cancelled = threading.Event()
            self.closed = threading.Event()
            self.open_returned = False
            self.cancel_before_open_returned = False
            self.close_count = 0
            self.read_count = 0
            self.seek_count = 0

    @read_type
    def read(cookie, destination, capacity):
        try:
            source = streams[cookie]
            source.read_count += 1
            source.read_started.set()
            if source.mode == "blocked-read":
                if not source.cancelled.wait(2):
                    callback_failures.append("Native read cancellation did not arrive.")
                return -1
            if source.cancelled.is_set():
                return -1
            count = min(int(capacity), len(payload) - source.position)
            if count:
                C.memmove(destination, payload[source.position:source.position + count], count)
                source.position += count
            return count
        except BaseException as error:
            callback_failures.append(type(error).__name__)
            return -1

    @seek_type
    def seek(cookie, offset):
        try:
            source = streams[cookie]
            source.seek_count += 1
            if source.mode == "blocked-initial-seek" and source.seek_count == 1:
                source.seek_started.set()
                if not source.release_seek.wait(2):
                    callback_failures.append("The bounded initial seek gate timed out.")
                    return constants["MPV_ERROR_GENERIC"]
            if source.cancelled.is_set() or offset < 0:
                return constants["MPV_ERROR_GENERIC"]
            source.position = min(int(offset), len(payload))
            return source.position
        except BaseException as error:
            callback_failures.append(type(error).__name__)
            return constants["MPV_ERROR_GENERIC"]

    @size_type
    def size(cookie):
        return len(payload)

    @close_type
    def close(cookie):
        source = streams[cookie]
        source.close_count += 1
        source.closed.set()

    @cancel_type
    def cancel(cookie):
        source = streams[cookie]
        source.cancel_before_open_returned |= not source.open_returned
        source.cancelled.set()

    reports = []
    for mode in ("client-lifetime", "blocked-read", "blocked-open", "blocked-initial-seek"):
        source = Source(mode)
        cookie = len(streams) + 1
        streams[cookie] = source

        @open_type
        def open_stream(userdata, uri, info):
            try:
                source.open_started.set()
                if source.mode == "blocked-open" and not source.release_open.wait(2):
                    callback_failures.append("The bounded open gate timed out.")
                    return constants["MPV_ERROR_LOADING_FAILED"]
                info[0] = StreamInfo(cookie, read, seek, size, close, cancel)
                source.open_returned = True
                return 0
            except BaseException as error:
                callback_failures.append(type(error).__name__)
                return constants["MPV_ERROR_LOADING_FAILED"]

        context = create()
        client = None
        helper = None
        try:
            client = library.mpv_create_weak_client(context, b"probe-registration")
            assert client
            success(library.mpv_stream_cb_add_ro(client, b"kisakiprobe", None, open_stream), "register protocol")
            duplicate = library.mpv_stream_cb_add_ro(context, b"kisakiprobe", None, open_stream)
            assert duplicate == constants["MPV_ERROR_INVALID_PARAMETER"]
            library.mpv_destroy(client)
            client = None
            command(context, "loadfile", "kisakiprobe://sample.wav")
            assert source.open_started.wait(3)
            cancelled_during_open = None
            cancelled_during_initial_seek = None
            if mode == "client-lifetime":
                wait(context, "FILE_LOADED")
            elif mode == "blocked-read":
                assert source.read_started.wait(3)
            else:
                if mode == "blocked-initial-seek":
                    assert source.seek_started.wait(3)
                def release_after_observation():
                    nonlocal cancelled_during_open, cancelled_during_initial_seek
                    time.sleep(0.2)
                    if mode == "blocked-open":
                        cancelled_during_open = source.cancelled.is_set()
                    else:
                        cancelled_during_initial_seek = source.cancelled.is_set()
                    source.release_open.set()
                    source.release_seek.set()
                helper = threading.Thread(target=release_after_observation)
                helper.start()
            command(context, "stop")
            assert source.closed.wait(3)
            if helper:
                helper.join(1)
                assert not helper.is_alive()
            assert source.close_count == 1
            if mode == "blocked-read":
                assert source.cancelled.is_set()
            if mode == "blocked-open":
                assert cancelled_during_open is False
                assert source.cancel_before_open_returned is False
            if mode == "blocked-initial-seek":
                assert cancelled_during_initial_seek is False
            reports.append({
                "case": mode, "registrationClientDestroyedBeforeLoad": True,
                "duplicateRegistrationError": duplicate,
                "readCalls": source.read_count, "seekCalls": source.seek_count,
                "cancelled": source.cancelled.is_set(), "closeCalls": source.close_count,
                "cancelCallbackDuringBlockedOpen": cancelled_during_open,
                "cancelCallbackDuringInitialSeek": cancelled_during_initial_seek,
            })
        finally:
            source.release_open.set()
            source.release_seek.set()
            source.cancelled.set()
            if client:
                library.mpv_destroy(client)
            library.mpv_terminate_destroy(context)
            if helper:
                helper.join(1)
    assert not callback_failures, callback_failures
    api_version = library.mpv_client_api_version()
    result = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "host": {"system": platform.system(), "version": platform.version(), "architecture": platform.machine()},
        "mpvVersion": version,
        "apiVersion": {"major": api_version >> 16, "minor": api_version & 0xffff},
        "dllSha256": binary["dllSha256"],
        "properties": properties,
        "propertyObservations": {
            "initialInvalidation": initial, "changedInvalidation": changed,
            "integer": observed_integer, "text": observed_text,
            "osdObservationError": osd_observation,
        },
        "clientModel": client_model,
        "streams": reports,
        "nativeCApiExecuted": True,
        "nodeAddonExecuted": False,
        "javascriptProviderBridgeExecuted": False,
        "graphicsExecuted": False,
        "selectedReleaseBuildVerified": False,
    }
    print(json.dumps(result))


if "--child" in sys.argv:
    execute()
else:
    if os.name != "nt":
        raise RuntimeError("This probe is only for Windows x64.")
    child = subprocess.run(
        [sys.executable, str(Path(__file__).resolve()), "--child"],
        capture_output=True, text=True, timeout=20,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    if child.returncode:
        sys.stderr.write(child.stderr[-5000:])
        raise SystemExit(child.returncode)
    result = json.loads(child.stdout)
    (ROOT / "native-contract.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "mpvVersion": result["mpvVersion"], "apiVersion": result["apiVersion"],
        "streamCases": len(result["streams"]), "nativeCApiExecuted": True,
        "nodeAddonExecuted": False, "graphicsExecuted": False,
    }))
