"""Collect fixed platform sources for design review, without platform execution."""
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import tempfile
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT/'node_modules/.cache/platform-design'
CACHE.mkdir(parents=True, exist_ok=True)
work = Path(tempfile.mkdtemp(prefix='closure-', dir=CACHE))

source_list = json.loads((HERE/'source-list.json').read_text(encoding='utf-8'))
sources = [(row['name'], row['url']) for row in source_list]

def fetch(entry):
    name, url = entry
    try:
        request = urllib.request.Request(url, headers={'User-Agent':'Kisaki-design-review'})
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
            path = work/(name+'.txt')
            path.write_bytes(body)
            return {'name':name, 'url':url, 'status':response.status, 'path':str(path),
                    'bytes':len(body), 'sha256':hashlib.sha256(body).hexdigest()}
    except Exception as error:
        return {'name':name, 'url':url, 'errorType':type(error).__name__,
                'httpStatus':getattr(error, 'code', None)}

with ThreadPoolExecutor(max_workers=6) as pool:
    rows = list(pool.map(fetch, sources))
result = {'readAt':datetime.now(timezone.utc).isoformat(), 'work':str(work), 'sources':rows,
          'scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
          'sourceListSha256':hashlib.sha256((HERE/'source-list.json').read_bytes()).hexdigest(),
          'macosExecuted':False, 'linuxExecuted':False, 'desktopRegistrationChanged':False}
(HERE/'source-input.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'downloaded':sum('path' in row for row in rows),
                  'unavailable':[row['name'] for row in rows if 'path' not in row]}))
