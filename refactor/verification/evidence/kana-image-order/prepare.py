"""Pin Unicode data for the proposed locale-independent image-member ordering."""
from pathlib import Path
from urllib.request import urlopen
from datetime import datetime, timezone
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-image-order'
CACHE.mkdir(parents=True, exist_ok=True)
URL = 'https://www.unicode.org/Public/18.0.0/ucd/UnicodeData.txt'
with urlopen(URL, timeout=30) as response:
    data = response.read()
(CACHE / 'UnicodeData.txt').write_bytes(data)
digits = {}
for line in data.decode('utf-8').splitlines():
    fields = line.split(';')
    if fields[2] == 'Nd':
        digits[int(fields[0], 16)] = int(fields[6])
fold_path = ROOT / 'node_modules/.cache/kana-content/casefold.txt'
fold_bytes = fold_path.read_bytes()
fold_receipt = json.loads((HERE.parent / 'kana-content/source-contract.json').read_text(encoding='utf-8'))
fold_source = next(item for item in fold_receipt['sources'] if item['name'] == 'casefold.txt')
assert hashlib.sha256(fold_bytes).hexdigest() == fold_source['sha256']
fold = {}
for line in fold_bytes.decode('utf-8').splitlines():
    fields = line.split('#', 1)[0].strip().split(';')
    if len(fields) > 2 and fields[1].strip() in ['C', 'F']:
        fold[int(fields[0], 16)] = [int(value, 16) for value in fields[2].split()]
payload = json.dumps({'digits': digits, 'fold': fold}, separators=(',', ':')).encode()
(CACHE / 'unicode.json').write_bytes(payload)
record = {
    'recordedAt': datetime.now(timezone.utc).isoformat(), 'unicodeVersion': '18.0.0',
    'decimalDigits': len(digits), 'caseFoldMappings': len(fold),
    'sources': [{'url': URL, 'file': 'UnicodeData.txt', 'sha256': hashlib.sha256(data).hexdigest()},
                {'url': fold_source['url'], 'file': '../kana-content/casefold.txt', 'sha256': fold_source['sha256']}],
    'dataSha256': hashlib.sha256(payload).hexdigest(),
}
(HERE / 'source-input.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'decimalDigits': len(digits), 'caseFoldMappings': len(fold)}))
