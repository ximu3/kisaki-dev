"""Fetch fixed parser candidates and the standard local entity catalog into an isolated cache."""
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import quote, unquote
from html.parser import HTMLParser
from datetime import datetime, timezone
import base64
import hashlib
import io
import json
import re
import subprocess
import tarfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-xml-input'
CACHE.mkdir(parents=True, exist_ok=True)
SEMVER = ROOT / 'node_modules/.pnpm/semver@7.8.5/node_modules/semver'
FIXED = {'saxes': '6.0.0', '@xmldom/xmldom': '0.9.12', 'fast-xml-parser': '5.11.2'}
TRANSITIVE = {
    'xmlchars': '2.2.0', 'strnum': '2.5.1', 'anynum': '1.0.1', 'is-unsafe': '2.0.2',
    'xml-naming': '0.3.0', 'fast-xml-builder': '1.3.1',
    'path-expression-matcher': '1.6.2', '@nodable/entities': '3.1.0',
}
packages = {}


def read_url(url):
    with urlopen(url, timeout=30) as response:
        return response.read()


def resolve(name, requirement):
    version = TRANSITIVE[name]
    result = subprocess.run(
        ['node', '-e', 'const s=require(process.argv[1]);let i="";process.stdin.on("data",c=>i+=c);process.stdin.on("end",()=>{const p=JSON.parse(i);process.stdout.write(s.satisfies(p.version,p.range)?p.version:"")})', str(SEMVER)],
        input=json.dumps({'version': version, 'range': requirement}),
        text=True, capture_output=True, check=True,
    )
    if not result.stdout:
        raise RuntimeError('Dependency version could not be resolved.')
    return result.stdout


def install(name, version):
    if name in packages:
        if packages[name]['version'] != version:
            raise RuntimeError('The isolated flat dependency set has incompatible versions.')
        return
    metadata_url = 'https://registry.npmjs.org/' + quote(name, safe='') + '/' + version
    metadata_bytes = read_url(metadata_url)
    metadata = json.loads(metadata_bytes)
    data = read_url(metadata['dist']['tarball'])
    algorithm, expected = metadata['dist']['integrity'].split('-', 1)
    assert base64.b64encode(hashlib.new(algorithm, data).digest()).decode() == expected
    destination = CACHE / 'node_modules' / name
    destination.mkdir(parents=True, exist_ok=True)
    file_hashes = {}
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        for member in archive.getmembers():
            if not member.isfile():
                continue
            relative = Path(member.name).relative_to('package')
            target = (destination / relative).resolve()
            assert target.is_relative_to(destination.resolve())
            payload = archive.extractfile(member).read()
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
            file_hashes[relative.as_posix()] = hashlib.sha256(payload).hexdigest()
    packages[name] = {
        'version': version, 'source': metadata['dist']['tarball'],
        'integrity': metadata['dist']['integrity'], 'sha256': hashlib.sha256(data).hexdigest(),
        'metadataSha256': hashlib.sha256(metadata_bytes).hexdigest(),
        'license': metadata.get('license'), 'files': file_hashes,
        'dependencies': metadata.get('dependencies', {}),
    }
    for child, requirement in metadata.get('dependencies', {}).items():
        install(child, resolve(child, requirement))


for name, version in FIXED.items():
    install(name, version)

reference_url = 'https://html.spec.whatwg.org/multipage/xhtml.html'
reference = read_url(reference_url)
(CACHE / 'xml-reference.html').write_bytes(reference)


class CatalogLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        href = values.get('href', '')
        if tag == 'a' and href.startswith('data:application/xml-dtd;'):
            self.links.append(href)


links = CatalogLinks()
links.feed(reference.decode('utf-8'))
assert len(links.links) == 1
media, payload = unquote(links.links[0]).split(',', 1)
assert media.endswith(';base64')
catalog = base64.b64decode(payload)
assert b'SYSTEM' not in catalog and b'PUBLIC' not in catalog
identifiers_section = reference.decode('utf-8').split('<ul class=brief>')[1].split('</ul>')[0]
identifiers = re.findall(r'<code>([^<]+)</code>', identifiers_section)
assert len(identifiers) == 11 and all(identifier.startswith('-//') for identifier in identifiers)
(CACHE / 'catalog.dtd').write_bytes(catalog)
(CACHE / 'catalog.json').write_text(json.dumps({'publicIds': identifiers, 'dtd': catalog.decode('utf-8')}, ensure_ascii=False), encoding='utf-8')
entities_url = 'https://html.spec.whatwg.org/entities.json'
entities = read_url(entities_url)
(CACHE / 'entities.json').write_bytes(entities)
encoding_url = 'https://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP1251.TXT'
encoding_bytes = read_url(encoding_url)
(CACHE / 'CP1251.TXT').write_bytes(encoding_bytes)
encoding_map = [-1] * 256
for line in encoding_bytes.decode('ascii').splitlines():
    match = re.match(r'0x([0-9A-Fa-f]+)\s+0x([0-9A-Fa-f]+)', line)
    if match:
        encoding_map[int(match.group(1), 16)] = int(match.group(2), 16)
old_maps = ROOT / 'node_modules/.cache/kana-formats/oem-maps.json'
old_map_data = json.loads(old_maps.read_text(encoding='utf-8'))
(CACHE / 'encoding-maps.json').write_text(json.dumps({
    'windows-1251': encoding_map, 'windows-1252': old_map_data['windows-1252'],
}), encoding='utf-8')

entry = CACHE / 'candidates-entry.mjs'
entry.write_text("export { SaxesParser } from 'saxes';\nexport { DOMParser } from '@xmldom/xmldom';\nexport { XMLParser, XMLValidator } from 'fast-xml-parser';\nexport { EntityDecoder, ENTITY_ACTION } from '@nodable/entities';\n", encoding='utf-8')
bundler = ROOT / 'node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild/bin/esbuild'
subprocess.run(['node', str(bundler), str(entry), '--bundle', '--format=esm', '--platform=browser',
                '--outfile=' + str(CACHE / 'candidates.mjs')], capture_output=True, text=True, check=True,
               creationflags=subprocess.CREATE_NO_WINDOW)
record = {
    'recordedAt': datetime.now(timezone.utc).isoformat(),
    'packages': packages, 'workspaceDependenciesChanged': False, 'packageScriptsExecuted': False,
    'references': [
        {'url': reference_url, 'file': 'xml-reference.html', 'sha256': hashlib.sha256(reference).hexdigest()},
        {'url': entities_url, 'file': 'entities.json', 'sha256': hashlib.sha256(entities).hexdigest()},
        {'url': encoding_url, 'file': 'CP1251.TXT', 'sha256': hashlib.sha256(encoding_bytes).hexdigest()},
    ],
    'catalog': {'source': reference_url + '#parsing-xhtml-documents', 'publicIds': identifiers,
                'bytes': len(catalog), 'sha256': hashlib.sha256(catalog).hexdigest()},
    'bundleSha256': hashlib.sha256((CACHE / 'candidates.mjs').read_bytes()).hexdigest(),
    'previousEncodingMapsSha256': hashlib.sha256(old_maps.read_bytes()).hexdigest(),
    'encodingMapsSha256': hashlib.sha256((CACHE / 'encoding-maps.json').read_bytes()).hexdigest(),
    'bundlerVersion': '0.28.1', 'resolverVersion': '7.8.5',
}
(HERE / 'source-input.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'packages': {name: value['version'] for name, value in packages.items()},
                  'catalogBytes': len(catalog), 'catalogPublicIds': len(identifiers)}))
