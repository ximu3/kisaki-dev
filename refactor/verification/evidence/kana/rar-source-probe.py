"""Record the RAR backend comparison without claiming decoder execution."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-design/rar-comparison'
CACHE.mkdir(parents=True, exist_ok=True)
RARS_COMMIT = 'c07b3e68b564489202afc0ac9fa1ab5ff82db6a6'
SOURCES = {
    'rarlab-changes.html': 'https://www.rarlab.com/rarnew.htm',
    'rarlab-downloads.html': 'https://www.rarlab.com/download.htm',
    'sevenzip-license.txt': 'https://www.7-zip.org/license.txt',
    'rars-readme.md': f'https://raw.githubusercontent.com/bitplane/rars/{RARS_COMMIT}/README.md',
    'rars-wasm-readme.md': f'https://raw.githubusercontent.com/bitplane/rars/{RARS_COMMIT}/crates/rars-wasm/README.md',
    'rars-wasm.rs': f'https://raw.githubusercontent.com/bitplane/rars/{RARS_COMMIT}/crates/rars-wasm/src/lib.rs',
    'rars-npm.json': 'https://registry.npmjs.org/@bitplane/rars/0.11.0',
    'unrar-rs-docs.html': 'https://docs.rs/unrar-rs/0.12.0/unrar_rs/',
    'unrar-rs-crate.json': 'https://crates.io/api/v1/crates/unrar-rs/0.12.0',
}


def fetch(item):
    name, url = item
    request = urllib.request.Request(url, headers={'User-Agent': 'Kisaki-design-verification'})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = response.read()
        receipt = {'name': name, 'url': url, 'finalUrl': response.url, 'status': response.status,
                   'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    (CACHE / name).write_bytes(data)
    return receipt


with ThreadPoolExecutor(max_workers=4) as executor:
    receipts = list(executor.map(fetch, SOURCES.items()))
readme = (CACHE / 'rars-wasm-readme.md').read_text(encoding='utf-8')
assert 'The current API materialises input and output bytes.' in readme
assert 'Filesystem scratch decoding is unavailable in the WASM backend.' in readme
result = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'sources': receipts,
          'rarsVersion': '0.11.0', 'rarsCommit': RARS_COMMIT, 'unrarRsVersion': '0.12.0',
          'unrarBaseline': '7.23', 'decoderExecuted': False, 'wasmBridgeExecuted': False,
          'performanceComparisonExecuted': False}
(HERE / 'rar-source-contract.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'sources': len(receipts), 'decoderExecuted': False}))
