"""Prepare the standard entity catalog and fixed encoding maps used by XML and source-mapping checks."""
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import unquote
from html.parser import HTMLParser
from datetime import datetime, timezone
import base64
import hashlib
import json
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-xml-input'
CACHE.mkdir(parents=True, exist_ok=True)
def read_url(url):
    with urlopen(url, timeout=30) as response:
        return response.read()


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
base_maps = ROOT / 'node_modules/.cache/kana-formats/oem-maps.json'
base_map_data = json.loads(base_maps.read_text(encoding='utf-8'))
(CACHE / 'encoding-maps.json').write_text(json.dumps({
    'windows-1251': encoding_map, 'windows-1252': base_map_data['windows-1252'],
}), encoding='utf-8')

record = {
    'recordedAt': datetime.now(timezone.utc).isoformat(),
    'references': [
        {'url': reference_url, 'file': 'xml-reference.html', 'sha256': hashlib.sha256(reference).hexdigest()},
        {'url': entities_url, 'file': 'entities.json', 'sha256': hashlib.sha256(entities).hexdigest()},
        {'url': encoding_url, 'file': 'CP1251.TXT', 'sha256': hashlib.sha256(encoding_bytes).hexdigest()},
    ],
    'catalog': {'source': reference_url + '#parsing-xhtml-documents', 'publicIds': identifiers,
                'bytes': len(catalog), 'sha256': hashlib.sha256(catalog).hexdigest()},
    'baseEncodingMapsSha256': hashlib.sha256(base_maps.read_bytes()).hexdigest(),
    'encodingMapsSha256': hashlib.sha256((CACHE / 'encoding-maps.json').read_bytes()).hexdigest(),
}
(HERE / 'source-input.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'catalogBytes': len(catalog), 'catalogPublicIds': len(identifiers)}))
