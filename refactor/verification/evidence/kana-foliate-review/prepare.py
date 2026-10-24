"""Pin the complete relevant Foliate modules and upstream tests for a direct comparison."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import sys
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-foliate-review'
CACHE.mkdir(parents=True, exist_ok=True)
COMMIT = '78914aef4466eb960965702401634c2cb348e9b1'
sys.path.insert(0, str(HERE.parent / 'kana-rar'))
from record import write_receipt
tree = json.load(urllib.request.urlopen(f'https://api.github.com/repos/johnfactotum/foliate-js/git/trees/{COMMIT}?recursive=1', timeout=30))
paths = [item['path'] for item in tree['tree'] if item['type'] == 'blob' and
         ((item['path'].endswith(('.js', '.json', '.html', '.md')) and
           (not item['path'].startswith('vendor/') or item['path'].endswith('README.md'))) or item['path'] == 'LICENSE')]
def fetch(name):
    url = f'https://raw.githubusercontent.com/johnfactotum/foliate-js/{COMMIT}/{name}'
    target = CACHE / name
    target.parent.mkdir(parents=True, exist_ok=True)
    data = urllib.request.urlopen(url, timeout=30).read()
    target.write_bytes(data)
    return {'path': name, 'source': url, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
with ThreadPoolExecutor(max_workers=4) as pool:
    sources = list(pool.map(fetch, paths))
url = 'https://html.spec.whatwg.org/multipage/xhtml.html'
data = urllib.request.urlopen(url, timeout=30).read()
(CACHE / 'html-xml-reference.html').write_bytes(data)
write_receipt(HERE / 'source-input.json', {'checkedAt': datetime.now(timezone.utc).isoformat(), 'commit': COMMIT,
    'sameCommitAsEarlierMobiEvidence': True, 'upstreamCodeModified': False, 'license': 'MIT', 'sources': sources,
    'references': [{'path': 'html-xml-reference.html', 'source': url, 'sha256': hashlib.sha256(data).hexdigest()}]})
print(json.dumps({'sources': len(sources), 'upstreamCodeModified': False}))
