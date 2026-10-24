"""Prepare isolated, verified tools and inspect an official Node image index."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import tempfile
import urllib.request
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT/'node_modules/.cache/oauth-relay-design'
CACHE.mkdir(parents=True, exist_ok=True)
work = Path(tempfile.mkdtemp(prefix='delivery-', dir=CACHE))
h = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()

def fetch(url, extra_headers=None):
    headers = {'User-Agent':'Kisaki-design-verification', **(extra_headers or {})}
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
        data = response.read()
        return data, {'url':url, 'finalUrl':response.url, 'status':response.status,
                      'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest()}

def checksum(text, name):
    for line in text.splitlines():
        fields = line.split()
        if len(fields) == 2 and fields[1].lstrip('*') == name:
            return fields[0]
    raise ValueError('The requested artifact is absent from official checksums.')

compose_version = 'v5.6.0'
compose_base = f'https://github.com/docker/compose/releases/download/{compose_version}'
checksums, compose_checksums = fetch(compose_base+'/checksums.txt')
compose_name = 'docker-compose-windows-x86_64.exe'
data, compose_archive = fetch(compose_base+'/'+compose_name)
assert hashlib.sha256(data).hexdigest() == checksum(checksums.decode(), compose_name)
compose_path = work/compose_name
compose_path.write_bytes(data)

node_version = 'v24.22.0'
node_base = f'https://nodejs.org/dist/{node_version}'
checksums, node_checksums = fetch(node_base+'/SHASUMS256.txt')
node_name = f'node-{node_version}-win-x64.zip'
data, node_archive = fetch(node_base+'/'+node_name)
assert hashlib.sha256(data).hexdigest() == checksum(checksums.decode(), node_name)
node_zip = work/node_name
node_zip.write_bytes(data)
node_path = work/'node.exe'
with zipfile.ZipFile(node_zip) as archive:
    node_path.write_bytes(archive.read(f'node-{node_version}-win-x64/node.exe'))

image_tag = '24.22.0-trixie-slim'
token_data, _ = fetch('https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/node:pull')
token = json.loads(token_data)['token']
accept = 'application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json'
image_data, image_receipt = fetch('https://registry-1.docker.io/v2/library/node/manifests/'+image_tag,
                                 {'Authorization':'Bearer '+token, 'Accept':accept})
index = json.loads(image_data)
image_file = work/'node-image-index.json'
image_file.write_bytes(image_data)
platforms = []
for architecture in ['amd64', 'arm64']:
    manifest = next(row for row in index['manifests'] if row['platform']['os']=='linux' and row['platform']['architecture']==architecture)
    data, source = fetch('https://registry-1.docker.io/v2/library/node/manifests/'+manifest['digest'],
                         {'Authorization':'Bearer '+token, 'Accept':accept})
    assert 'sha256:'+hashlib.sha256(data).hexdigest() == manifest['digest']
    path = work/f'node-image-{architecture}.json'
    path.write_bytes(data)
    platforms.append({'platform':manifest['platform'], 'digest':manifest['digest'], 'path':str(path), 'source':source})
token = None
token_data = None

protocol = json.loads((HERE.parent/'oauth-relay-protocol/source-input.json').read_text(encoding='utf-8'))
for package in protocol['packages']:
    assert h(package['entry']) == package['entrySha256']
result = {'preparedAt':datetime.now(timezone.utc).isoformat(), 'work':str(work),
          'compose':{'version':compose_version, 'path':str(compose_path), 'archive':compose_archive, 'checksums':compose_checksums},
          'node':{'version':node_version, 'path':str(node_path), 'exeSha256':h(node_path), 'archive':node_archive, 'checksums':node_checksums},
          'baseImage':{'tag':'node:'+image_tag, 'reference':'node:'+image_tag+'@sha256:'+image_receipt['sha256'],
                       'index':image_receipt, 'path':str(image_file), 'platforms':platforms},
          'packages':protocol['packages'], 'protocolInputSha256':h(HERE.parent/'oauth-relay-protocol/source-input.json'),
          'prepareSha256':h(__file__), 'dockerEngineUsed':False, 'baseImageLayersDownloaded':False,
          'systemInstallationChanged':False, 'realCredentialsUsed':False}
(HERE/'source-input.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'compose':compose_version, 'node':node_version, 'baseImage':result['baseImage']['reference'],
                  'platforms':[row['platform']['architecture'] for row in platforms]}))
