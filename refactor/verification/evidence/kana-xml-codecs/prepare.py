"""Generate owned encoding fixtures with independent Python and libxml2 expectations."""
from pathlib import Path
from datetime import datetime, timezone
import base64
import hashlib
import json
import re
import urllib.request
from lxml import etree

HERE = Path(__file__).resolve().parent
CACHE = HERE.parents[3] / 'node_modules/.cache/kana-xml-codecs'
catalog = [
    ('UTF-8', 'utf-8', '中文 😀'),
    ('UTF-16LE', 'utf-16le', '中文 😀'),
    ('UTF-16BE', 'utf-16be', '中文 😀'),
    ('UTF-32LE', 'utf-32le', '中文 😀'),
    ('UTF-32BE', 'utf-32be', '中文 😀'),
    ('ISO-8859-1', 'iso8859-1', 'café \u0080'),
    ('ISO-8859-9', 'iso8859-9', 'Ğı \u0080'),
    ('ISO-8859-2', 'iso8859-2', 'Zażółć'),
    ('ISO-8859-5', 'iso8859-5', 'Книга'),
    ('ISO-8859-7', 'iso8859-7', 'Βιβλίο'),
    ('ISO-8859-15', 'iso8859-15', '€ œ'),
    ('windows-1251', 'cp1251', 'Книга €'),
    ('windows-1252', 'cp1252', 'café €'),
    ('KOI8-R', 'koi8-r', 'Книга'),
    ('KOI8-U', 'koi8-u', 'Книга і'),
    ('Shift_JIS', 'shift_jis', '日本語 〜'),
    ('CP932', 'cp932', '日本語 ～'),
    ('EUC-JP', 'euc_jp', '日本語'),
    ('ISO-2022-JP', 'iso2022_jp', '日本語'),
    ('GB2312', 'gb2312', '中文'),
    ('GBK', 'gbk', '中文'),
    ('GB18030', 'gb18030', '中文 😀'),
    ('Big5', 'big5', '繁體中文'),
    ('Big5-HKSCS', 'big5hkscs', '繁體 𠄌'),
    ('EUC-KR', 'euc_kr', '한국어'),
    ('CP949', 'cp949', '한국어')
]

def tree(node):
    name = etree.QName(node)
    attrs = []
    for key, value in node.attrib.items():
        qname = etree.QName(key)
        attrs.append([(qname.namespace + '\x1f' if qname.namespace else '') + qname.localname, value])
    children = []
    def text(value):
        if not value:
            return
        if children and isinstance(children[-1], str):
            children[-1] += value
        else:
            children.append(value)
    text(node.text)
    for child in node:
        if isinstance(child.tag, str):
            children.append(tree(child))
        text(child.tail)
    return {'name': name.localname, 'namespace': name.namespace or '', 'attributes': sorted(attrs),
            'children': children}

cases = []
for label, codec, text in catalog:
    xml = '<?xml version="1.0" encoding="' + label + '"?><root xmlns="urn:proof"><p a="A&#13;B">'
    xml += text + '\r\nA<!-- comment --><![CDATA[B]]><?pi ignored?>C&amp;</p></root>'
    payload = xml.encode(codec, errors='strict')
    expected = tree(etree.fromstring(xml.encode('utf-8').replace(label.encode(), b'UTF-8', 1)))
    independent = None
    try:
        independent = tree(etree.fromstring(payload)) == expected
    except etree.XMLSyntaxError:
        independent = False
    cases.append({
        'name': label, 'codec': label, 'pythonCodec': codec,
        'bytes': base64.b64encode(payload).decode(), 'length': len(payload),
        'sha256': hashlib.sha256(payload).hexdigest(), 'expectedTree': expected,
        'libxml2OriginalBytesMatch': independent
    })
long_xml = '<?xml version="1.0" encoding="ISO-2022-JP"?><root><p>' + '日本語 ABC\r\n' * 5000 + '</p></root>'
payload = long_xml.encode('iso2022_jp')
cases.append({
    'name': 'ISO-2022-JP-long', 'codec': 'ISO-2022-JP', 'pythonCodec': 'iso2022_jp',
    'bytes': base64.b64encode(payload).decode(), 'length': len(payload),
    'sha256': hashlib.sha256(payload).hexdigest(),
    'expectedTree': tree(etree.fromstring(payload)), 'libxml2OriginalBytesMatch': True,
    'chunks': [7, 4096]
})
data = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'lxml': etree.LXML_VERSION,
        'libxml2': etree.LIBXML_VERSION, 'cases': cases}
table_url = 'https://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/CP932.TXT'
table_file = CACHE / 'CP932.TXT'
if not table_file.exists():
    table_file.write_bytes(urllib.request.urlopen(table_url, timeout=30).read())
assert hashlib.sha256(table_file.read_bytes()).hexdigest() == 'c9bc0b0cd42e0fbcb82a09635bb5abed86afbdd4abc9e76fa5716638217cb59f'
data['cp932'] = []
for line in table_file.read_text(encoding='ascii').splitlines():
    match = re.match(r'^0x([0-9A-Fa-f]+)\s+0x([0-9A-Fa-f]+)', line)
    if match:
        data['cp932'].append([int(match[1], 16), int(match[2], 16)])
(CACHE / 'fixtures.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
receipt = {'checkedAt': data['checkedAt'], 'cases': len(cases), 'lxml': data['lxml'], 'libxml2': data['libxml2'],
           'fixturesSha256': hashlib.sha256((CACHE / 'fixtures.json').read_bytes()).hexdigest(),
           'scriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
           'originalBytesLibxml2Matches': sum(case['libxml2OriginalBytesMatch'] for case in cases),
           'cp932': {'url': table_url, 'sha256': hashlib.sha256(table_file.read_bytes()).hexdigest(),
                     'definedMappings': len(data['cp932'])},
           'syntheticContentOnly': True}
(HERE / 'source-input.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt))
