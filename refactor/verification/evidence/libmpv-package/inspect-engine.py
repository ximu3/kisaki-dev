"""Query the candidate's actual libraries and execute one script in each language."""

from datetime import datetime, timezone
from pathlib import Path
import ctypes as C
import json
import os
import time

from audit import HERE, digest, package_owners, save


def text_function(library, name):
    function = getattr(library, name)
    function.restype = C.c_char_p
    return function().decode("utf-8")


def render_system_font(runtime):
    library = C.CDLL(str(runtime / "libass-9.dll"), winmode=0x1100)

    class AssImage(C.Structure):
        pass

    AssImage._fields_ = [("width", C.c_int), ("height", C.c_int), ("stride", C.c_int),
                        ("bitmap", C.POINTER(C.c_uint8)), ("color", C.c_uint32),
                        ("x", C.c_int), ("y", C.c_int), ("next", C.POINTER(AssImage)), ("kind", C.c_int)]
    signatures = {
        "ass_library_init": (C.c_void_p, []), "ass_library_done": (None, [C.c_void_p]),
        "ass_renderer_init": (C.c_void_p, [C.c_void_p]), "ass_renderer_done": (None, [C.c_void_p]),
        "ass_set_frame_size": (None, [C.c_void_p, C.c_int, C.c_int]),
        "ass_set_fonts": (None, [C.c_void_p, C.c_char_p, C.c_char_p, C.c_int, C.c_char_p, C.c_int]),
        "ass_read_memory": (C.c_void_p, [C.c_void_p, C.c_char_p, C.c_size_t, C.c_char_p]),
        "ass_free_track": (None, [C.c_void_p]),
        "ass_render_frame": (C.POINTER(AssImage), [C.c_void_p, C.c_void_p, C.c_longlong, C.POINTER(C.c_int)]),
    }
    for name, (result, arguments) in signatures.items():
        function = getattr(library, name)
        function.restype, function.argtypes = result, arguments
    context = library.ass_library_init()
    assert context
    renderer = track = None
    try:
        renderer = library.ass_renderer_init(context)
        assert renderer
        library.ass_set_frame_size(renderer, 320, 180)
        # The standard Windows provider must work without a developer fontconfig directory.
        library.ass_set_fonts(renderer, None, b"Arial", 1, None, 1)
        source = (HERE / "font.ass").read_bytes()
        buffer = C.create_string_buffer(source)
        track = library.ass_read_memory(context, buffer, len(source), None)
        assert track
        changed = C.c_int()
        image = library.ass_render_frame(renderer, track, 1000, C.byref(changed))
        count = nonzero = 0
        while image:
            value = image.contents
            assert 0 <= value.width <= 320 and 0 <= value.height <= 180 and value.stride >= value.width
            if value.width and value.height:
                address = C.addressof(value.bitmap.contents)
                for row in range(value.height):
                    nonzero += sum(byte != 0 for byte in C.string_at(address + row * value.stride, value.width))
            count += 1
            image = value.next
        assert count > 0 and nonzero > 0
        return {"providerSelection": "autodetect", "fixture": "font.ass", "images": count,
                "nonzeroCoveragePixels": nonzero, "frameSize": [320, 180],
                "fontFilesBundledByProbe": False, "fontconfigEnvironmentOverride": False}
    finally:
        if track:
            library.ass_free_track(track)
        if renderer:
            library.ass_renderer_done(renderer)
        library.ass_library_done(context)


def main():
    for name in ["FONTCONFIG_FILE", "FONTCONFIG_PATH"]:
        os.environ.pop(name, None)
    build = json.loads((HERE / "engine-build.json").read_text())
    old = json.loads((HERE / "dependency-audit.json").read_text())
    runtime = Path(build["runtime"])
    for file in build["files"]:
        assert digest(runtime / file["name"]) == file["sha256"]
    libraries = {name: C.CDLL(str(runtime / file), winmode=0x1100) for name, file in [
        ("mpv", "libmpv-2.dll"), ("codec", "avcodec-63.dll"),
        ("format", "avformat-63.dll"), ("filter", "avfilter-12.dll"),
    ]}
    ffmpeg = {}
    for name, prefix in [("codec", "avcodec"), ("format", "avformat"), ("filter", "avfilter")]:
        ffmpeg[name] = {field: text_function(libraries[name], prefix + "_" + field)
                        for field in ["license", "configuration"]}
        assert ffmpeg[name]["license"] == "LGPL version 2.1 or later", ffmpeg[name]["license"]

    class NamedEntry(C.Structure):
        # AVCodec and AVFilter both expose their name as the first public member.
        _fields_ = [("name", C.c_char_p)]

    def names(library, iterator_name, predicate_name=None):
        iterator = getattr(library, iterator_name)
        iterator.argtypes = [C.POINTER(C.c_void_p)]
        iterator.restype = C.c_void_p
        predicate = getattr(library, predicate_name) if predicate_name else None
        if predicate:
            predicate.argtypes = [C.c_void_p]
            predicate.restype = C.c_int
        opaque = C.c_void_p()
        result = []
        while True:
            entry = iterator(C.byref(opaque))
            if not entry:
                return sorted(result)
            if not predicate or predicate(entry):
                result.append(C.cast(entry, C.POINTER(NamedEntry)).contents.name.decode("ascii"))

    decoders = names(libraries["codec"], "av_codec_iterate", "av_codec_is_decoder")
    filters = names(libraries["filter"], "av_filter_iterate")
    protocol = libraries["format"].avio_enum_protocols
    protocol.argtypes = [C.POINTER(C.c_void_p), C.c_int]
    protocol.restype = C.c_char_p
    opaque = C.c_void_p()
    protocols = []
    while True:
        value = protocol(C.byref(opaque), 0)
        if not value:
            break
        protocols.append(value.decode("ascii"))
    assert {"h264", "hevc", "libdav1d", "vp9", "aac", "flac", "ass", "subrip", "pgssub"} <= set(decoders)
    assert {"scale", "zscale", "tonemap", "libplacebo", "ass", "subtitles", "aresample", "atempo"} <= set(filters)
    assert {"file", "http", "https", "tcp", "udp", "rtp", "rtmp", "tls"} <= set(protocols)

    mpv = libraries["mpv"]
    signatures = {
        "mpv_client_api_version": (C.c_ulong, []),
        "mpv_create": (C.c_void_p, []),
        "mpv_set_option_string": (C.c_int, [C.c_void_p, C.c_char_p, C.c_char_p]),
        "mpv_initialize": (C.c_int, [C.c_void_p]),
        "mpv_command": (C.c_int, [C.c_void_p, C.POINTER(C.c_char_p)]),
        "mpv_get_property_string": (C.c_void_p, [C.c_void_p, C.c_char_p]),
        "mpv_free": (None, [C.c_void_p]),
        "mpv_terminate_destroy": (None, [C.c_void_p]),
    }
    for name, (result, arguments) in signatures.items():
        function = getattr(mpv, name)
        function.restype = result
        function.argtypes = arguments
    api_version = mpv.mpv_client_api_version()
    assert api_version == 0x20006
    core = mpv.mpv_create()
    assert core
    properties = {}
    try:
        for key, value in [("config", "no"), ("load-scripts", "no"), ("terminal", "no"),
                           ("vo", "null"), ("ao", "null")]:
            assert mpv.mpv_set_option_string(core, key.encode(), value.encode()) >= 0
        assert mpv.mpv_initialize(core) >= 0
        for name in ["engine.lua", "engine.js"]:
            command = (C.c_char_p * 3)(b"load-script", str(HERE / name).encode("utf-8"), None)
            assert mpv.mpv_command(core, command) >= 0
        deadline = time.monotonic() + 5
        required = ["user-data/engine-lua-ready", "user-data/engine-js-ready"]
        # A node-valued property's string representation is JSON, including string quotes.
        ready_text = json.dumps("ready")
        while time.monotonic() < deadline:
            for name in [*required, "mpv-version", "mpv-configuration"]:
                value = mpv.mpv_get_property_string(core, name.encode())
                if value:
                    properties[name] = C.string_at(value).decode("utf-8")
                    mpv.mpv_free(value)
            if all(properties.get(name) == ready_text for name in required):
                break
            time.sleep(0.02)
        assert all(properties.get(name) == ready_text for name in required), properties
    finally:
        mpv.mpv_terminate_destroy(core)
    font = render_system_font(runtime)
    inputs = json.loads((HERE / "engine-input.json").read_text())
    owners = package_owners()
    components = {item["name"]: {key: item[key] for key in ["name", "version", "url", "sha256"]}
                  for item in inputs["inputs"] if item["kind"] == "source"}
    def component(file):
        if file["name"] == "libmpv-2.dll":
            return {"name": "mpv", "commit": build["sourceCommit"], "patchSha256": build["patchSha256"]}
        if file["name"] == "mujs.dll":
            return components["mujs"]
        if Path(file["source"]).parent == Path(inputs["work"]) / "prefix/bin":
            return components["ffmpeg"]
        return owners[file["name"].lower()]
    files = [{"path": "native/" + file["name"], "source": str(runtime / file["name"]),
              "role": "media-runtime", "sha256": file["sha256"], "bytes": file["bytes"],
              "imports": file["imports"], "component": component(file)} for file in build["files"]]
    files.extend(file for file in old["files"] if file["role"] != "media-runtime")
    save(HERE / "engine-audit.json", {
        "checkedAt": datetime.now(timezone.utc).isoformat(), "target": "win32-x64-msvc",
        "scope": "private research package, not a release candidate", "engineStage": "Windows design candidate",
        "files": sorted(files, key=lambda file: file["path"].lower()), "ffmpeg": ffmpeg,
        "inputProtocols": sorted(protocols), "decoders": decoders, "filters": filters,
        "mpvProperties": properties, "clientApiVersion": "2.6", "features": build["features"], "systemFont": font,
        "buildReceiptSha256": digest(HERE / "engine-build.json"), "coreClosed": True,
        "sources": {name: digest(HERE / name) for name in ["audit.py", "inspect-engine.py", "engine.lua", "engine.js", "font.ass"]},
        "nativeAudioOutputExecuted": False, "hardwareDecodeExecuted": False,
        "networkTransferExecuted": False, "dynamicPluginsAndDataAudited": False,
        "licensesComplete": False, "sixTargetBuildTupleFrozen": False,
    })
    print(json.dumps({"files": len(files), "decoders": len(decoders), "filters": len(filters),
                      "protocols": len(protocols), "lua": True, "javascript": True}))


if __name__ == "__main__":
    main()
