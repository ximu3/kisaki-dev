"""Fetch pinned public packages and primary sources for an isolated HTTP proof."""
from pathlib import Path
from datetime import datetime, timezone
import base64
import hashlib
import json
import tarfile
import tempfile
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT/'node_modules/.cache/oauth-relay-design'
CACHE.mkdir(parents=True, exist_ok=True)
work = Path(tempfile.mkdtemp(prefix='protocol-', dir=CACHE))
h = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()

def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent':'Kisaki-design-verification'})
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read()
        return data, {'url':url, 'finalUrl':response.url, 'status':response.status,
                      'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest()}

packages = []
for name, version in [('hono', '4.13.13'), ('@hono/node-server', '2.1.5')]:
    metadata, registry = fetch('https://registry.npmjs.org/'+name.replace('/', '%2f')+'/'+version)
    package = json.loads(metadata)
    data, archive = fetch(package['dist']['tarball'])
    algorithm, expected = package['dist']['integrity'].split('-', 1)
    assert algorithm == 'sha512' and base64.b64encode(hashlib.sha512(data).digest()).decode() == expected
    tarpath = work/(name.replace('/', '-').replace('@', '')+'.tgz')
    tarpath.write_bytes(data)
    extracted = work/('extract-'+str(len(packages)))
    extracted.mkdir()
    with tarfile.open(tarpath) as tar:
        tar.extractall(extracted, filter='data')
    destination = work/'node_modules'/name
    destination.parent.mkdir(parents=True, exist_ok=True)
    (extracted/'package').rename(destination)
    installed = json.loads((destination/'package.json').read_text(encoding='utf-8'))
    assert installed['name'] == name and installed['version'] == version
    export = installed['exports']['.']['import']
    entry = export['default'] if isinstance(export, dict) else export
    packages.append({'name':name, 'version':version, 'registry':registry, 'archive':archive,
                     'integrity':package['dist']['integrity'], 'entry':str(destination/entry),
                     'entrySha256':h(destination/entry), 'packageSha256':h(destination/'package.json')})

urls = {
    'oauth-core':'https://www.rfc-editor.org/rfc/rfc6749.txt',
    'pkce':'https://www.rfc-editor.org/rfc/rfc7636.txt',
    'native-apps':'https://www.rfc-editor.org/rfc/rfc8252.txt',
    'oauth-security':'https://www.rfc-editor.org/rfc/rfc9700.txt',
    'bangumi':'https://raw.githubusercontent.com/bangumi/api/65d29cff2331e08c0110d30d515f7f1b6488f845/docs-raw/How-to-Auth.md',
    'anilist':'https://raw.githubusercontent.com/AniList/docs/master/docs/guide/auth/authorization-code.md',
    'anilist-javascript':'https://raw.githubusercontent.com/AniList/docs/master/docs/guide/snippets/auth/authorization-code/javascript.js',
    'google-discovery':'https://accounts.google.com/.well-known/openid-configuration',
    'google-web':'https://developers.google.com/identity/protocols/oauth2/web-server',
    'hono-node':'https://hono.dev/docs/getting-started/nodejs',
}
sources = []
for name, url in urls.items():
    data, receipt = fetch(url)
    path = work/(name+'.txt')
    path.write_bytes(data)
    sources.append({'name':name, 'path':str(path), **receipt})
result = {'preparedAt':datetime.now(timezone.utc).isoformat(), 'work':str(work), 'packages':packages,
          'sources':sources, 'prepareSha256':h(__file__), 'workspaceDependenciesChanged':False,
          'installScriptsExecuted':False, 'productionDependencyTupleFrozen':False}
(HERE/'source-input.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'packages':[{key:row[key] for key in ['name','version']} for row in packages],
                  'sources':len(sources), 'work':str(work)}))
