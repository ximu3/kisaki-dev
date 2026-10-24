"""Record source evidence for the terminal rendering-contract discussion."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import re
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT/'node_modules/.cache/libmpv-design/output-sources'
MPV = '01e2533f3143b8940857ca419b0b367f583e05ca'
ELECTRON = '19c601167d4ae75989938416c18ed81eb21c6020'
PLACEBO = '0df80ae'

SOURCES = [
    ('mpv','mpv-player/mpv',MPV,'include/mpv/render.h'),
    ('mpv','mpv-player/mpv',MPV,'video/out/vo_libmpv.c'),
    ('mpv','mpv-player/mpv',MPV,'video/out/libmpv_sw.c'),
    ('mpv','mpv-player/mpv',MPV,'video/out/gpu/libmpv_gpu.c'),
    ('mpv','mpv-player/mpv',MPV,'video/out/gpu/video.c'),
    ('mpv','mpv-player/mpv',MPV,'video/out/gpu/video_shaders.c'),
    ('mpv','mpv-player/mpv',MPV,'video/csputils.h'),
    ('mpv','mpv-player/mpv',MPV,'DOCS/man/options.rst'),
    ('libplacebo','haasn/libplacebo',PLACEBO,'src/colorspace.c'),
    ('libplacebo','haasn/libplacebo',PLACEBO,'src/include/libplacebo/colorspace.h'),
    ('electron','electron/electron',ELECTRON,'docs/api/structures/color-space.md'),
    ('electron','electron/electron',ELECTRON,'docs/api/structures/shared-texture-import-texture-info.md'),
    ('electron','electron/electron',ELECTRON,'docs/api/shared-texture.md'),
]


def fetch(item):
    label,repo,revision,path=item
    url=f'https://raw.githubusercontent.com/{repo}/{revision}/{path}'
    with urllib.request.urlopen(url,timeout=25) as response:
        data=response.read()
        status=response.status
    target=CACHE/label/path
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(data)
    return (label,path),data.decode('utf-8'),{'repository':repo,'revision':revision,'path':path,
           'url':url,'status':status,'sha256':hashlib.sha256(data).hexdigest()}


with ThreadPoolExecutor(max_workers=4) as pool:
    fetched=list(pool.map(fetch,SOURCES))
bodies={key:body for key,body,_ in fetched}
header=bodies['mpv','include/mpv/render.h']
core=bodies['mpv','video/out/vo_libmpv.c']
sw=bodies['mpv','video/out/libmpv_sw.c']
options=bodies['mpv','DOCS/man/options.rst']
gpu=bodies['mpv','video/out/gpu/video.c']
shaders=bodies['mpv','video/out/gpu/video_shaders.c']
placebo=bodies['libplacebo','src/colorspace.c']
placebo_header=bodies['libplacebo','src/include/libplacebo/colorspace.h']
checks={
    'softwareHasSeparatePixelContract':all(value in header for value in ['MPV_RENDER_PARAM_SW_FORMAT','uninitialized garbage','HDR may not work']),
    'softwareDoesNotUseGpuTargetOptions':'target_trc' not in sw and 'target_prim' not in sw and 'mp_sws_scale' in sw,
    'scrgbDocumentedForGpuNextOnly':bool(re.search(r'    scrgb\n.*?gpu-next.*?only',options,re.S)),
    'embeddedRendererUsesGlVideo':'gl_video_init(' in bodies['mpv','video/out/gpu/libmpv_gpu.c'],
    'linearAndScrgbSkipNativeOutputEncoding':'if (trc == PL_COLOR_TRC_LINEAR || trc == PL_COLOR_TRC_SCRGB)' in shaders,
    'linearReferenceWhiteIs203':'#define PL_COLOR_SDR_WHITE 203.0f' in placebo_header and '#define MP_REF_WHITE 203.0' in bodies['mpv','video/csputils.h'],
    'scrgbReferenceWhiteIs80':'#define PL_COLOR_SCRGB_WHITE 80.0f' in placebo_header,
    'hdrClassificationIncludesTargetPeak':'return csp->hdr.max_luma > PL_COLOR_SDR_WHITE' in placebo,
    'alphaPremultiplicationPrecedesOutputColorMapping':gpu.index('straight -> premul') < gpu.index('static void pass_colormanage('),
    'publicShaderHooksExist':all(f'"{name}"' in gpu for name in ['SCALED','OUTPUT']),
    'swapReportsHaveNoTimestampArgument':'mpv_render_context_report_swap(mpv_render_context *ctx);' in header,
    'swapReportingMustBeConsistent':'If you use it inconsistently' in header and 'ctx->flip_count += 1;' in core,
    'missingSwapReportsHaveNativeTimeout':'MP_TIME_MS_TO_NS(200)' in core and 'if (!ctx->flip_count)' in core,
    'electronHasScRgb80Descriptor':'scrgb-linear-80-nits' in bodies['electron','docs/api/structures/color-space.md'],
    'electronDocumentsTimestampAndReleaseLifetime':'timestamp' in bodies['electron','docs/api/structures/shared-texture-import-texture-info.md'] and 'allReferencesReleased' in bodies['electron','docs/api/shared-texture.md'],
}
assert all(checks.values()),[name for name,matched in checks.items() if not matched]
receipt={'checkedAt':datetime.now(timezone.utc).isoformat(),'checks':checks,
         'sources':[item for _,_,item in fetched],
         'libplaceboReferenceIsNotExactDirtyBuildSource':True,
         'sourceChecksAreNotRuntimeValidation':True,
         'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
(HERE/'source-contract.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'sources':len(fetched),'checks':len(checks)}))
