"""Record primary references for pagination, source selection and browser capability decisions."""
from pathlib import Path
from urllib.request import urlopen
from datetime import datetime, timezone
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-presentation/references'
CACHE.mkdir(parents=True, exist_ok=True)
references = [
    ('multicol.html', 'https://drafts.csswg.org/css-multicol-2/'),
    ('chromium-columns.html', 'https://developer.chrome.com/blog/multicol-wrapping'),
    ('writing-modes.html', 'https://www.w3.org/TR/css-writing-modes-4/'),
    ('selection.html', 'https://www.w3.org/TR/selection-api/'),
    ('clipboard.html', 'https://www.w3.org/TR/clipboard-apis/'),
    ('webkit-events.html', 'https://bugs.webkit.org/show_bug.cgi?id=218086'),
    ('column-wrap-compat.json', 'https://raw.githubusercontent.com/mdn/browser-compat-data/main/css/properties/column-wrap.json'),
]
record = []
for name, url in references:
    with urlopen(url, timeout=30) as response:
        data = response.read()
        resolved = response.url
    (CACHE / name).write_bytes(data)
    record.append({'url': url, 'resolvedUrl': resolved, 'file': name,
                   'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
(HERE / 'references.json').write_text(json.dumps({
    'recordedAt': datetime.now(timezone.utc).isoformat(), 'references': record,
}, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'recordedReferences': len(record)}))
