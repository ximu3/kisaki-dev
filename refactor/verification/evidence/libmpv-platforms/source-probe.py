"""Check pinned rendering and stream boundaries without executing native libraries."""

import hashlib
import html
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MPV = "41f6a645068483470267271e1d09966ca3b9f413"
ELECTRON = "19c601167d4ae75989938416c18ed81eb21c6020"
ANGLE = "b82a564646a26535ccedfa7a69134c0fd6654ac2"


def raw(repo, revision, path):
    return f"https://raw.githubusercontent.com/{repo}/{revision}/{path}"


SOURCES = {
    "render-header": (raw("mpv-player/mpv", MPV, "include/mpv/render.h"), [
        "MPV_RENDER_API_TYPE_OPENGL", "MPV_RENDER_API_TYPE_SW",
        "Currently, there can be only 1 mpv_render_context",
        "before the mpv core",
    ]),
    "render-gl-header": (raw("mpv-player/mpv", MPV, "include/mpv/render_gl.h"), [
        "Windows: ANGLE is required", "macOS: CGL is required", "mpv_opengl_fbo",
    ]),
    "stream-header": (raw("mpv-player/mpv", MPV, "include/mpv/stream_cb.h"), [
        "Protocols remain registered until the mpv instance is terminated",
        "custom callbacks must not invoke libmpv APIs", "mpv_stream_cb_cancel_fn",
    ]),
    "gpu-renderer": (raw("mpv-player/mpv", MPV, "video/out/gpu/libmpv_gpu.c"), [
        "&libmpv_gpu_context_gl", "gl_video_init(", "gl_video_init_hwdecs(",
    ]),
    "windows-hwdec": (raw("mpv-player/mpv", MPV, "video/out/opengl/hwdec_d3d11egl.c"), [
        "EGL_ANGLE_stream_producer_d3d_texture", "EGL_D3D11_DEVICE_ANGLE",
    ]),
    "macos-hwdec": (raw("mpv-player/mpv", MPV, "video/out/hwdec/hwdec_mac_gl.c"), [
        "CGLGetCurrentContext()", "CGLTexImageIOSurface2D(", "CVPixelBufferGetIOSurface(",
    ]),
    "linux-vaapi": (raw("mpv-player/mpv", MPV, "video/out/hwdec/hwdec_vaapi.c"), [
        '"drm_params_v2"', "vaGetDisplayDRM(params->render_fd)", "dmabuf_interop_gl_init",
    ]),
    "angle-loader": (raw("mpv-player/mpv", MPV, "video/out/opengl/angle_dynamic.c"), [
        "HAVE_EGL_ANGLE_LIB", 'LoadLibraryW(L"LIBEGL.DLL")',
    ]),
    "mpv-build": (raw("mpv-player/mpv", MPV, "meson.build"), [
        "dependency('libavcodec'", "dependency('libass'", "dependency('libplacebo'",
        "features += {'egl-angle-lib'",
    ]),
    "mpv-color-options": (raw("mpv-player/mpv", MPV, "DOCS/man/options.rst"), [
        "--target-colorspace-hint=<auto|yes|no>", "--target-peak=<auto|nits>",
        "--tone-mapping=<value>", "--hdr-compute-peak=<auto|yes|no>",
        "does not send full HDR10+",
    ]),
    "mpv-output-drivers": (raw("mpv-player/mpv", MPV, "DOCS/man/vo.rst"), [
        "recommended output driver is ``--vo=gpu-next``",
        "Video renderer based on ``libplacebo``",
    ]),
    "mpv-gl-color": (raw("mpv-player/mpv", MPV, "video/out/gpu/video.c"), [
        "static void pass_colormanage(", "fbo_csp->transfer",
        "dst.primaries = PL_COLOR_PRIM_BT_709;",
        "dst.transfer = PL_COLOR_TRC_GAMMA22;",
    ]),
    "electron-handle": (raw("electron/electron", ELECTRON, "docs/api/structures/shared-texture-handle.md"), [
        "ntHandle", "ioSurface", "nativePixmap", "supportsZeroCopyWebGpuImport",
    ]),
    "electron-import-info": (raw("electron/electron", ELECTRON, "docs/api/structures/shared-texture-import-texture-info.md"), [
        "rgbaf16", "colorSpace", "visibleRect",
    ]),
    "electron-lifetime": (raw("electron/electron", ELECTRON, "docs/api/shared-texture.md"), [
        "allReferencesReleased", "all references in all processes are released",
    ]),
    "electron-import": (raw("electron/electron", ELECTRON, "shell/common/api/electron_api_shared_texture.cc"), [
        "DuplicateHandle(", "scoped_policy::RETAIN", "dup(plane.fd)",
        "gpu::SharedImageUsageSet shared_image_usage", "base::StringToUint64",
    ]),
    "electron-rgb-mutex": (raw("electron/electron", ELECTRON, "patches/chromium/osr_shared_texture_remove_keyed_mutex_on_win_dxgi.patch"), [
        "D3D11_RESOURCE_MISC_SHARED_NTHANDLE", "D3D11_RESOURCE_MISC_SHARED_KEYEDMUTEX",
        "PIXEL_FORMAT_RGBAF16",
    ]),
    "angle-d3d-input": (raw("google/angle", ANGLE, "extensions/EGL_ANGLE_d3d_texture_client_buffer.txt"), [
        "EGL_ANGLE_d3d_texture_client_buffer", "EGL_D3D_TEXTURE_ANGLE", "ID3D11Texture2D",
    ]),
    "angle-build": (raw("google/angle", ANGLE, "BUILD.gn"), [
        "angle_libs_suffix", "ANGLE_EGL_LIBRARY_NAME", "ANGLE_GLESV2_LIBRARY_NAME",
    ]),
    "dma-buf-export": ("https://registry.khronos.org/EGL/extensions/MESA/EGL_MESA_image_dma_buf_export.txt", [
        "EGL_MESA_image_dma_buf_export", "eglExportDMABUFImageMESA", "modifiers",
    ]),
    "apple-opengl": ("https://developer.apple.com/library/archive/documentation/GraphicsImaging/Conceptual/OpenGL-MacProgGuide/opengl_intro/opengl_intro.html", [
        "OpenGL was deprecated in macOS 10.14",
    ]),
    "windows-nt-handle": ("https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_2/nf-dxgi1_2-idxgiresource1-createsharedhandle", [
        "CreateSharedHandle", "NT handle", "DuplicateHandle",
    ]),
}


def fetch(item):
    name, (url, markers) = item
    request = urllib.request.Request(url, headers={"User-Agent": "Kisaki-design-verification"})
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read()
        receipt = {
            "name": name, "url": url, "finalUrl": response.url,
            "status": response.status,
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
        }
    body = data.decode("utf-8")
    normalized = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", body)))
    receipt["markers"] = {marker: marker in body or marker in normalized for marker in markers}
    if not all(receipt["markers"].values()):
        missing = [marker for marker, found in receipt["markers"].items() if not found]
        raise ValueError(f"Missing expected markers in {name}: {missing}.")
    return name, body, receipt


def exported_functions(header):
    stripped = re.sub(r"/\*.*?\*/", "", header, flags=re.S)
    declarations = re.findall(r"^MPV_EXPORT\s+.*?;", stripped, re.M | re.S)
    return [re.search(r"\b(mpv_\w+)\s*\(", declaration).group(1) for declaration in declarations]


with ThreadPoolExecutor(max_workers=6) as pool:
    fetched = list(pool.map(fetch, SOURCES.items()))
bodies = {name: body for name, body, _ in fetched}
usage = bodies["electron-import"].split("gpu::SharedImageUsageSet shared_image_usage", 1)[1]
usage = usage.split("#endif", 1)[0]
windows_macos_usage, linux_usage = usage.split("#else", 1)
assert "SHARED_IMAGE_USAGE_WEBGPU" in windows_macos_usage
assert "SHARED_IMAGE_USAGE_WEBGPU" not in linux_usage
assert "SHARED_IMAGE_USAGE_GLES2_READ" in linux_usage
assert "SHARED_IMAGE_USAGE_DISPLAY_READ" in linux_usage

result = {
    "status": "platform-and-output-proposal-source-review",
    "mpv": {"version": "0.41.0", "commit": MPV},
    "electron": {"version": "44.5.1", "commit": ELECTRON},
    "angle": {"commit": ANGLE, "selectedForRelease": False},
    "renderFunctions": exported_functions(bodies["render-header"]),
    "streamFunctions": exported_functions(bodies["stream-header"]),
    "publicRenderBackends": ["opengl", "sw"],
    "electronLinuxImportDeclaresWebGpuUsage": False,
    "electronLinuxImportDeclaresGlAndDisplayUsage": True,
    "nativeLibmpvExecuted": False,
    "addonExecuted": False,
    "hardwareDecodingVerified": False,
    "textureInteropVerified": False,
    "hdrPresentationVerified": False,
    "sixTargetBuildsVerified": False,
    "sources": [receipt for _, _, receipt in fetched],
}
assert len(result["renderFunctions"]) == 8
assert result["streamFunctions"] == ["mpv_stream_cb_add_ro"]
(ROOT / "source-contract.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps({
    "sources": len(fetched), "renderFunctions": len(result["renderFunctions"]),
    "streamFunctions": len(result["streamFunctions"]), "nativeExecuted": False,
}))
