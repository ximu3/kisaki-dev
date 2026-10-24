"""Exercise the documented software Render API in an isolated bounded process."""
from datetime import datetime, timezone
from pathlib import Path
import ctypes as C
import hashlib
import json
import math
import subprocess
import sys
import threading
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]


def execute():
    binary = json.loads((HERE.parent/'libmpv-native/binary-input.json').read_text(encoding='utf-8'))
    inputs = json.loads((HERE.parent/'libmpv-gpu/binary-input.json').read_text(encoding='utf-8'))
    assert hashlib.sha256(Path(binary['dll']).read_bytes()).hexdigest() == binary['dllSha256']
    assert hashlib.sha256(Path(inputs['sample']['path']).read_bytes()).hexdigest() == inputs['sample']['sha256']
    lib = C.CDLL(binary['dll'], winmode=0x1100)

    class Param(C.Structure):
        _fields_ = [('type', C.c_int), ('data', C.c_void_p)]

    class Event(C.Structure):
        _fields_ = [('id', C.c_int), ('error', C.c_int), ('userdata', C.c_uint64), ('data', C.c_void_p)]

    callback_type = C.CFUNCTYPE(None, C.c_void_p)
    signatures = {
        'mpv_create': (C.c_void_p, []),
        'mpv_set_option_string': (C.c_int, [C.c_void_p, C.c_char_p, C.c_char_p]),
        'mpv_initialize': (C.c_int, [C.c_void_p]),
        'mpv_get_property_string': (C.c_void_p, [C.c_void_p, C.c_char_p]),
        'mpv_set_property_string': (C.c_int, [C.c_void_p, C.c_char_p, C.c_char_p]),
        'mpv_command_async': (C.c_int, [C.c_void_p, C.c_uint64, C.POINTER(C.c_char_p)]),
        'mpv_wait_event': (C.POINTER(Event), [C.c_void_p, C.c_double]),
        'mpv_render_context_create': (C.c_int, [C.POINTER(C.c_void_p), C.c_void_p, C.POINTER(Param)]),
        'mpv_render_context_set_update_callback': (None, [C.c_void_p, callback_type, C.c_void_p]),
        'mpv_render_context_update': (C.c_uint64, [C.c_void_p]),
        'mpv_render_context_render': (C.c_int, [C.c_void_p, C.POINTER(Param)]),
        'mpv_render_context_free': (None, [C.c_void_p]),
        'mpv_terminate_destroy': (None, [C.c_void_p]),
        'mpv_free': (None, [C.c_void_p]),
    }
    for name, (result, arguments) in signatures.items():
        fn = getattr(lib, name)
        fn.restype, fn.argtypes = result, arguments

    def success(code):
        assert code >= 0, f'Native software operation failed ({code}).'

    def string(handle, name):
        ptr = lib.mpv_get_property_string(handle, name.encode())
        if not ptr:
            return None
        try:
            return C.string_at(ptr).decode('utf-8')
        finally:
            lib.mpv_free(ptr)

    handle = lib.mpv_create()
    assert handle
    context = C.c_void_p()
    updated = threading.Event()
    callback = callback_type(lambda _: updated.set())
    held = []
    try:
        for name, value in [('config','no'), ('load-scripts','no'), ('terminal','no'),
                            ('idle','yes'), ('pause','yes'), ('ao','null'), ('vo','libmpv'),
                            ('hwdec','no'), ('keep-open','yes'), ('image-display-duration','inf'),
                            ('osc','no'), ('osd-level','0'), ('target-trc','srgb')]:
            success(lib.mpv_set_option_string(handle, name.encode(), value.encode()))
        api = C.create_string_buffer(b'sw')
        advanced = C.c_int(1)
        init = (Param*3)(Param(1,C.cast(api,C.c_void_p)), Param(10,C.cast(C.pointer(advanced),C.c_void_p)), Param())
        success(lib.mpv_render_context_create(C.byref(context),handle,init))
        lib.mpv_render_context_set_update_callback(context,callback,None)
        success(lib.mpv_initialize(handle))
        versions = {name:string(handle,name) for name in ['mpv-version','libplacebo-version','ffmpeg-version']}

        def render(width, height, pixel_format):
            bpp = 3 if pixel_format == 'rgb24' else 4
            alignment = math.lcm(64,bpp)
            stride = ((width*bpp+alignment-1)//alignment)*alignment
            storage = C.create_string_buffer(stride*height+63)
            pointer = (C.addressof(storage)+63)&~63
            C.memset(pointer,0,stride*height)
            size = (C.c_int*2)(width,height)
            fmt = C.create_string_buffer(pixel_format.encode())
            native_stride = C.c_size_t(stride)
            block = C.c_int(0)
            params = (Param*6)(
                Param(17,C.cast(size,C.c_void_p)), Param(18,C.cast(fmt,C.c_void_p)),
                Param(19,C.cast(C.pointer(native_stride),C.c_void_p)), Param(20,pointer),
                Param(12,C.cast(C.pointer(block),C.c_void_p)), Param())
            success(lib.mpv_render_context_render(context,params))
            raw = C.string_at(pointer,stride*height)
            values=[]
            for x,y in [(0.25,0.25),(0.75,0.25),(0.25,0.75),(0.75,0.75),(0.5,0.5)]:
                at = int(y*height)*stride + int(x*width)*bpp
                values.append(list(raw[at:at+bpp]))
            held.append((storage,pointer,raw))
            return {'format':pixel_format,'width':width,'height':height,'stride':stride,
                    'aligned':pointer%64==0 and stride%64==0,'samples':values,
                    'sha256':hashlib.sha256(raw).hexdigest()}

        blank=render(63,47,'bgr0')
        assert all(value[:3]==[0,0,0] for value in blank['samples'])
        args=(C.c_char_p*3)(b'loadfile',inputs['sample']['path'].encode(),None)
        success(lib.mpv_command_async(handle,1,args))
        loaded=False
        rendered=False
        deadline=time.monotonic()+6
        while not (loaded and rendered):
            assert time.monotonic()<deadline,'Software rendering did not become ready.'
            if updated.is_set():
                updated.clear()
                if lib.mpv_render_context_update(context)&1:
                    frame=render(63,47,'bgr0')
                    rendered = frame['samples'][0][:3]==[0,0,255]
            while True:
                event=lib.mpv_wait_event(handle,0).contents
                if event.id==0: break
                if event.id==8: loaded=True
                if event.id==5: success(event.error)
            time.sleep(0.001)

        formats=[render(63,47,fmt) for fmt in ['rgb0','bgr0','0bgr','0rgb','rgb24']]
        before=render(63,47,'bgr0')
        success(lib.mpv_set_property_string(handle,b'target-trc',b'linear'))
        after=render(63,47,'bgr0')
        resized=render(31,23,'bgr0')
        assert before['samples']==after['samples']
        lib.mpv_render_context_free(context)
        context=C.c_void_p()
        lib.mpv_terminate_destroy(handle)
        handle=None
        assert all(C.string_at(pointer,len(raw))==raw for _,pointer,raw in held)
        return {'checkedAt':datetime.now(timezone.utc).isoformat(),'versions':versions,
                'dllSha256':binary['dllSha256'],'blank':blank,'formats':formats,'resized':resized,
                'targetTrcChangeAffectedPixels':False,'heldStorageStableAfterClose':True,
                'softwareRenderApiExecuted':True,'sourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    finally:
        if context: lib.mpv_render_context_free(context)
        if handle: lib.mpv_terminate_destroy(handle)


if __name__=='__main__':
    if '--child' in sys.argv:
        print(json.dumps(execute()))
    else:
        result=subprocess.run([sys.executable,__file__,'--child'],cwd=ROOT,capture_output=True,
                              text=True,timeout=15,creationflags=subprocess.CREATE_NO_WINDOW)
        if result.returncode:
            raise RuntimeError(f'Software probe failed ({result.returncode}).\n{result.stderr}')
        receipt=json.loads(result.stdout)
        receipt['stderr']=result.stderr
        (HERE/'software-contract.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({'formats':len(receipt['formats']),'softwareRenderApiExecuted':True,
                          'targetTrcChangeAffectedPixels':receipt['targetTrcChangeAffectedPixels']}))
