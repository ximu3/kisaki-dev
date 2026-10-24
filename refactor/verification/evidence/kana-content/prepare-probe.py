"""Fetch fixed source inputs for content projection and view-capture design checks."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-content'
CACHE.mkdir(parents=True, exist_ok=True)
SOURCES = {
    'casefold.txt': 'https://www.unicode.org/Public/18.0.0/ucd/CaseFolding.txt',
    'css-text.html': 'https://www.w3.org/TR/css-text-3/',
    'css-ruby.html': 'https://www.w3.org/TR/css-ruby-1/',
    'unicode-normalization.html': 'https://www.unicode.org/reports/tr15/',
    'capture.md': 'https://raw.githubusercontent.com/electron/electron/v44.5.1/docs/api/web-contents.md',
    'native-image.md': 'https://raw.githubusercontent.com/electron/electron/v44.5.1/docs/api/native-image.md',
}


def fetch(item):
    name, url = item
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Kisaki-design-verification'}), timeout=30) as response:
        data = response.read()
        receipt = {'name': name, 'url': url, 'finalUrl': response.url, 'status': response.status,
                   'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    (CACHE / name).write_bytes(data)
    return receipt


with ThreadPoolExecutor(max_workers=4) as executor:
    receipts = list(executor.map(fetch, SOURCES.items()))
body = (CACHE / 'casefold.txt').read_text(encoding='utf-8')
assert 'CaseFolding-18.0.0.txt' in body
folding = {}
for line in body.splitlines():
    fields = line.split('#', 1)[0].strip().split(';')
    if len(fields) >= 3 and fields[1].strip() in ['C', 'F']:
        folding[fields[0].strip()] = ''.join(chr(int(code, 16)) for code in fields[2].split())
(CACHE / 'casefold.json').write_text(json.dumps({'unicodeVersion': '18.0.0', 'map': folding}, ensure_ascii=False), encoding='utf-8')
(HERE / 'source-contract.json').write_text(json.dumps({'checkedAt': datetime.now(timezone.utc).isoformat(), 'sources': receipts,
    'caseFoldingVersion': '18.0.0', 'foldMappings': len(folding), 'kanaExecuted': False}, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'sources': len(receipts), 'foldMappings': len(folding)}))
