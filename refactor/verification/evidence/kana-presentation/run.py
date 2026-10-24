"""Run the native presentation probe with the previously pinned hidden Electron runtime."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
options = argparse.ArgumentParser()
options.add_argument('--project-runtime', action='store_true')
arguments = options.parse_args()
CACHE = ROOT / 'node_modules/.cache/kana-presentation' / ('project' if arguments.project_runtime else 'reference')
runtime_receipt = HERE.parent / 'libmpv-gpu/binary-input.json'
runtime = json.loads(runtime_receipt.read_text(encoding='utf-8'))['electron']['runtime']
if arguments.project_runtime:
    runtime = ROOT / 'node_modules/.pnpm/electron@41.2.0/node_modules/electron/dist'
environment = dict(os.environ)
environment.pop('ELECTRON_RUN_AS_NODE', None)
result = subprocess.run(
    [str(Path(runtime) / 'electron.exe'), str(HERE / 'probe.cjs'), str(CACHE), str(CACHE / 'browser-result.json')],
    env=environment, capture_output=True, text=True, encoding='utf-8', timeout=40,
    creationflags=subprocess.CREATE_NO_WINDOW,
)
if result.returncode:
    raise RuntimeError('Presentation mechanism probe failed:\n' + result.stderr)
record = json.loads((CACHE / 'browser-result.json').read_text(encoding='utf-8'))
record['runnerSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
record['runtimeReceiptSha256'] = hashlib.sha256(runtime_receipt.read_bytes()).hexdigest()
if arguments.project_runtime:
    record.pop('runtimeReceiptSha256')
    record['runtimeExecutableSha256'] = hashlib.sha256((Path(runtime) / 'electron.exe').read_bytes()).hexdigest()
    record['runtimePackageSha256'] = hashlib.sha256((Path(runtime).parent / 'package.json').read_bytes()).hexdigest()
(HERE / ('project-browser-contract.json' if arguments.project_runtime else 'browser-contract.json')).write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({
    'electron': record['electron'], 'chromium': record['chromium'],
    'columnConfigurations': len(record['samples']), 'paginationCases': len(record['pagination']),
    'initialSlotCases': len(record['initialSlots']),
    'typographyCases': len(record['typography']), 'caretCases': len(record['caret']),
    'deferredClipboardPayload': record['deferredClipboardPayload'],
    'clipboardWritten': record['clipboardWritten'], 'externalRequests': record['externalRequests'],
}))
