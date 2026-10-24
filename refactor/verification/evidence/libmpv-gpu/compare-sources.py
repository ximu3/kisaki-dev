"""Compare the exercised rendering sections against the fixed design revision."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import difflib
import json
import re
import urllib.request

HERE = Path(__file__).resolve().parent
REVISIONS = {'design':'41f6a645068483470267271e1d09966ca3b9f413',
             'probe':'01e2533f3143b8940857ca419b0b367f583e05ca'}
PATHS = ['include/mpv/render.h','include/mpv/render_gl.h','video/out/vo_libmpv.c',
         'video/out/gpu/libmpv_gpu.c','player/screenshot.c','options/m_config_frontend.c']


def fetch(item):
    label,revision,path=item
    url=f'https://raw.githubusercontent.com/mpv-player/mpv/{revision}/{path}'
    with urllib.request.urlopen(url,timeout=25) as response:
        data=response.read();status=response.status
    return label,path,data.decode('utf-8'),{'revision':revision,'path':path,'source':url,
         'status':status,'sha256':hashlib.sha256(data).hexdigest()}


with ThreadPoolExecutor(max_workers=4) as pool:
    fetched=list(pool.map(fetch,[(label,rev,path) for label,rev in REVISIONS.items() for path in PATHS]))
bodies={(label,path):body for label,path,body,_ in fetched}
comparisons=[]
for path in PATHS:
    same=bodies['design',path]==bodies['probe',path]
    item={'path':path,'sameFile':same}
    if not same:
        item['diff']=list(difflib.unified_diff(bodies['design',path].splitlines(),
                                             bodies['probe',path].splitlines(),n=2))
    comparisons.append(item)
for path,name in [
    ('video/out/vo_libmpv.c','mpv_render_context_create'),
    ('video/out/vo_libmpv.c','mpv_render_context_render'),
    ('video/out/vo_libmpv.c','mpv_render_context_free'),
    ('player/screenshot.c','cmd_screenshot_raw'),
    ('options/m_config_frontend.c','m_config_set_option_raw')
]:
    extracted={}
    for label in REVISIONS:
        match=re.search(rf'^(?:static )?(?:int|void) {name}\([^;]*?\n\{{.*?^\}}',
                        bodies[label,path],re.M|re.S)
        assert match,(label,path,name)
        extracted[label]=match.group(0)
    comparisons.append({'path':path,'function':name,'sameBody':extracted['design']==extracted['probe'],
                        'sha256':{label:hashlib.sha256(body.encode()).hexdigest() for label,body in extracted.items()}})
result={'checkedAt':datetime.now(timezone.utc).isoformat(),'revisions':REVISIONS,
        'comparisons':comparisons,'sources':[receipt for _,_,_,receipt in fetched],
        'provesDesignRevisionExecuted':False}
(HERE/'source-comparison.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'comparisons':len(comparisons),'same':sum(row.get('sameFile',row.get('sameBody')) for row in comparisons)}))
