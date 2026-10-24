"""Inventory a pinned native build and exercise managed-setting entry paths."""
from datetime import datetime, timezone
from pathlib import Path
import ctypes as C
import hashlib
import json
import math
import re
import subprocess
import sys
import time
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT/'node_modules/.cache/libmpv-design/catalog'
BASELINE = '41f6a645068483470267271e1d09966ca3b9f413'


def execute():
    CACHE.mkdir(parents=True, exist_ok=True)
    binary = json.loads((HERE.parent/'libmpv-native/binary-input.json').read_text(encoding='utf-8'))
    assert hashlib.sha256(Path(binary['dll']).read_bytes()).hexdigest() == binary['dllSha256']
    source = f'https://raw.githubusercontent.com/mpv-player/mpv/{BASELINE}/include/mpv/client.h'
    with urllib.request.urlopen(source, timeout=20) as response:
        header = response.read()
    exports = re.findall(r'MPV_EXPORT\s+[^;]+?\b(mpv_\w+)\s*\([^;]*?\)\s*;',
                         header.decode('utf-8'))
    coverage=json.loads((HERE.parent/'libmpv-control/client-api-coverage.json').read_text(encoding='utf-8'))
    assert set(exports)=={row['name'] for row in coverage['functions']}
    library = C.CDLL(binary['dll'], winmode=0x1100)

    class Node(C.Structure): pass
    class NodeList(C.Structure): pass
    class Bytes(C.Structure): _fields_ = [('data',C.c_void_p),('size',C.c_size_t)]
    class Value(C.Union):
        _fields_ = [('string',C.c_char_p),('flag',C.c_int),('integer',C.c_int64),
                    ('real',C.c_double),('list',C.POINTER(NodeList)),('bytes',C.POINTER(Bytes))]
    Node._fields_ = [('value',Value),('format',C.c_int)]
    NodeList._fields_ = [('count',C.c_int),('values',C.POINTER(Node)),('keys',C.POINTER(C.c_char_p))]
    signatures = {
        'mpv_create':(C.c_void_p,[]), 'mpv_initialize':(C.c_int,[C.c_void_p]),
        'mpv_set_option_string':(C.c_int,[C.c_void_p,C.c_char_p,C.c_char_p]),
        'mpv_get_property':(C.c_int,[C.c_void_p,C.c_char_p,C.c_int,C.c_void_p]),
        'mpv_set_property_string':(C.c_int,[C.c_void_p,C.c_char_p,C.c_char_p]),
        'mpv_command':(C.c_int,[C.c_void_p,C.POINTER(C.c_char_p)]),
        'mpv_load_config_file':(C.c_int,[C.c_void_p,C.c_char_p]),
        'mpv_free_node_contents':(None,[C.POINTER(Node)]),
        'mpv_terminate_destroy':(None,[C.c_void_p]),
        'mpv_client_api_version':(C.c_ulong,[]),
    }
    for name,(result,args) in signatures.items():
        function=getattr(library,name);function.restype=result;function.argtypes=args

    def decode(node):
        kind,value=node.format,node.value
        if kind==0:return None
        if kind==1:return value.string.decode('utf-8')
        if kind==3:return bool(value.flag)
        if kind==4:return {'int64':str(value.integer)}
        if kind==5:return value.real if math.isfinite(value.real) else {'double':str(value.real)}
        if kind in [7,8]:
            sequence=value.list.contents
            assert 0 <= sequence.count <= 10000
            values=[decode(sequence.values[i]) for i in range(sequence.count)]
            if kind==7:return values
            keys=[sequence.keys[i].decode('utf-8') for i in range(sequence.count)]
            assert len(keys)==len(set(keys))
            return dict(zip(keys,values))
        raise RuntimeError('Unsupported metadata format in probe.')

    def get(core,name,allow_unavailable=False,record_error=False):
        node=Node()
        code=library.mpv_get_property(core,name.encode(),6,C.byref(node))
        if code<0:
            if record_error:return {'metadataErrorCode':code}
            if allow_unavailable:return None
            raise RuntimeError(f'Probe metadata failed: {name}, code {code}.')
        try:return decode(node)
        finally:library.mpv_free_node_contents(C.byref(node))

    def create(script=None,config=None):
        core=library.mpv_create();assert core
        try:
            for name,value in [('config','no'),('load-scripts','no'),('terminal','no'),
                               ('idle','yes'),('ao','null'),('vo','libmpv'),('target-trc','srgb')]:
                assert library.mpv_set_option_string(core,name.encode(),value.encode())==0
            if config:
                assert library.mpv_load_config_file(core,str(config).encode())==0
            if script:
                assert library.mpv_set_option_string(core,b'scripts',str(script).encode())==0
            assert library.mpv_initialize(core)==0
            return core
        except BaseException:
            library.mpv_terminate_destroy(core)
            raise

    core=create()
    try:
        commands=get(core,'command-list')
        properties=get(core,'property-list')
        options=get(core,'options')
        definitions=[]
        for name in options:
            information=get(core,'option-info/'+name,record_error=True)
            # Runtime defaults may contain host-specific paths; this is a schema inventory.
            definitions.append({'name':name,**{key:value for key,value in information.items()
                if key in ['type','min','max','choices','expects-file','flags','metadataErrorCode']}})
        identity={'mpvVersion':get(core,'mpv-version'),'clientApi':library.mpv_client_api_version(),
                  'sourceCommit':binary['sourceCommit'],'dllSha256':binary['dllSha256']}
        initial={'vo':get(core,'vo'),'targetTrc':get(core,'target-trc')}
        direct_codes={name:library.mpv_set_property_string(core,name.encode(),value.encode())
                      for name,value in [('vo','null'),('target-trc','linear')]}
        direct={'codes':direct_codes,'vo':get(core,'vo'),'targetTrc':get(core,'target-trc')}
        assert all(code==0 for code in direct_codes.values())
        expected_vo=[{'name':'null','enabled':True,'params':{}}]
        assert direct['vo']==expected_vo and direct['targetTrc']=='linear'
    finally:library.mpv_terminate_destroy(core)

    script=CACHE/'settings.lua'
    script.write_text("mp.set_property('vo', 'null')\nmp.set_property('target-trc', 'linear')\n"
                      "mp.set_property_native('user-data/probe-settings', true)\n",encoding='utf-8')
    core=create(script=script)
    try:
        deadline=time.monotonic()+3
        while get(core,'user-data/probe-settings',True) is not True:
            assert time.monotonic()<deadline
            time.sleep(.005)
        scripted={'vo':get(core,'vo'),'targetTrc':get(core,'target-trc')}
        assert scripted['vo']==expected_vo and scripted['targetTrc']=='linear'
    finally:library.mpv_terminate_destroy(core)

    config=CACHE/'profiles.conf'
    config.write_text('[probe-switch]\nvo=null\ntarget-trc=linear\n',encoding='utf-8')
    core=create(config=config)
    try:
        command=(C.c_char_p*3)(b'apply-profile',b'probe-switch',None)
        code=library.mpv_command(core,command)
        profile={'code':code,'vo':get(core,'vo'),'targetTrc':get(core,'target-trc')}
        assert code==0 and profile['vo']==expected_vo and profile['targetTrc']=='linear'
    finally:library.mpv_terminate_destroy(core)

    catalog={'identity':identity,'commands':commands,'properties':properties,'options':definitions}
    (HERE/'catalog.json').write_text(json.dumps(catalog,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    receipt={'checkedAt':datetime.now(timezone.utc).isoformat(),'identity':identity,
        'baselineHeader':{'source':source,'sha256':hashlib.sha256(header).hexdigest(),'exports':exports},
        'counts':{'clientFunctions':len(exports),'commands':len(commands),'properties':len(properties),
                  'options':len(options)},
        'commandArgumentTypes':sorted({arg['type'] for row in commands for arg in row['args']}),
        'optionTypes':sorted({row['type'] for row in definitions if 'type' in row}),
        'optionMetadataErrors':[{'name':row['name'],'code':row['metadataErrorCode']}
                                for row in definitions if 'metadataErrorCode' in row],
        'managedSettingPaths':{'initial':initial,'direct':direct,'script':scripted,'profile':profile},
        'nativeSettingsGuardImplemented':False,'catalogMatchesSelectedRelease':False,
        'propertyResultShapesInferred':False,'clientFunctionMappingUnchanged':True,
        'probeSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    (HERE/'runtime-contract.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(receipt['counts']))


if __name__=='__main__':
    if '--child' in sys.argv:
        execute()
    else:
        child=subprocess.run([sys.executable,str(Path(__file__).resolve()),'--child'],cwd=ROOT,
            capture_output=True,text=True,timeout=40,creationflags=subprocess.CREATE_NO_WINDOW)
        print(child.stdout,end='')
        if child.returncode:
            print(child.stderr,end='',file=sys.stderr)
            raise SystemExit(child.returncode)
