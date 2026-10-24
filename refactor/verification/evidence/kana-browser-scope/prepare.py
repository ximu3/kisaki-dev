"""Prepare isolated Firefox and WebKit test runtimes without changing workspace dependencies."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import os
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-browser-scope'
BROWSERS = CACHE / 'browsers'
BUNDLE = Path('C:/Users/ximu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')
PLAYWRIGHT = BUNDLE / 'playwright'
CORE = BUNDLE / 'playwright-core'
CHROMIUM = Path('C:/Users/ximu/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe')
CACHE.mkdir(parents=True, exist_ok=True)
assert CHROMIUM.is_file()
metadata = json.loads((CORE / 'browsers.json').read_text(encoding='utf-8'))
package = json.loads((PLAYWRIGHT / 'package.json').read_text(encoding='utf-8'))
assert package['version'] == '1.62.1'
environment = dict(os.environ)
environment['PLAYWRIGHT_BROWSERS_PATH'] = str(BROWSERS)
environment['PLAYWRIGHT_SKIP_BROWSER_GC'] = '1'
result = subprocess.run(
    ['node', str(PLAYWRIGHT / 'cli.js'), 'install', 'firefox', 'webkit'],
    env=environment, capture_output=True, text=True, encoding='utf-8', timeout=240,
    creationflags=subprocess.CREATE_NO_WINDOW,
)
(CACHE / 'download-log.txt').write_text(result.stdout + result.stderr, encoding='utf-8')
if result.returncode:
    raise RuntimeError('The isolated browser runtime preparation failed.')
runtime_metadata = subprocess.run(
    ['node', '-e', 'const p=require(process.argv[1]);process.stdout.write(JSON.stringify({firefox:p.firefox.executablePath(),webkit:p.webkit.executablePath()}))', str(PLAYWRIGHT)],
    env=environment, capture_output=True, text=True, encoding='utf-8', check=True,
)
executables = {'chromium': str(CHROMIUM), **json.loads(runtime_metadata.stdout)}
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
record = {
    'recordedAt': datetime.now(timezone.utc).isoformat(), 'platform': 'Windows',
    'playwrightVersion': package['version'], 'playwrightPath': str(PLAYWRIGHT),
    'browserCachePath': str(BROWSERS), 'chromiumReusedFromExistingTestCache': True,
    'playwrightPackageSha256': sha(PLAYWRIGHT / 'package.json'),
    'browserMetadataSha256': sha(CORE / 'browsers.json'),
    'downloadLogSha256': sha(CACHE / 'download-log.txt'),
    'prepareScriptSha256': sha(HERE / 'prepare.py'),
    'selectedMetadata': [item for item in metadata['browsers'] if item['name'] in ['firefox', 'webkit']],
    'executables': {name: {'path': path, 'sha256': sha(Path(path))} for name, path in executables.items()},
    'safariOrWebKitGtkInstalled': False, 'workspaceDependenciesChanged': False,
}
(HERE / 'source-input.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'prepared': True, 'playwright': package['version'], 'runtimes': list(executables)}))
