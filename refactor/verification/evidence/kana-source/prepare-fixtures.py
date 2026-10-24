"""Create controlled source files and independent XML expectations for address proofs."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import sys
import urllib.request
from lxml import etree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-source'
FIXTURES = CACHE / 'fixtures'
FIXTURES.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(HERE.parent / 'kana-rar'))
from record import write_receipt

COMMIT = '4d3740e319039911c30d291abb0c8b26ec99703b'
schema_files = []
for name in ['FictionBook.xsd', 'FictionBookLinks.xsd', 'FictionBookGenres.xsd', 'FictionBookLang.xsd']:
    url = f'https://raw.githubusercontent.com/gribuser/fb2/{COMMIT}/{name}'
    target = CACHE / name
    if not target.exists():
        target.write_bytes(urllib.request.urlopen(url, timeout=30).read())
    schema_files.append({'name': name, 'source': url, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
schema = etree.XMLSchema(etree.parse(str(CACHE / 'FictionBook.xsd')))

cases = []
def save(name, data, **fields):
    (FIXTURES / name).write_bytes(data)
    record = {'name': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), **fields}
    cases.append(record)
    return record

unicode_text = '章一\r\n甲\r乙\n\t e\u0301 é 😀 𠮷\u00a0終\n'
for name, codec, bom in [('utf8.txt', 'utf-8', b'\xef\xbb\xbf'),
                         ('utf16le.txt', 'utf-16le', b'\xff\xfe'),
                         ('utf16be.txt', 'utf-16be', b'\xfe\xff')]:
    save(name, bom + unicode_text.encode(codec), format='txt', encoding=codec, expected=unicode_text)
for name, codec, canonical, text in [
    ('shift-jis.txt', 'shift_jis', 'shift_jis', '第一章\r\nかな・カナ\t終\r'),
    ('gb18030.txt', 'gb18030', 'gb18030', '第一章\r\n汉字𠮷\t終\n'),
    ('windows1252.txt', 'cp1252', 'windows-1252', 'Café €\r\n“déjà”\tfin\r'),
    ('iso2022jp.txt', 'iso2022_jp', 'iso-2022-jp', '先頭ABC日本語\r\nかなZ')]:
    save(name, text.encode(codec), format='txt', encoding=canonical, expected=text)
save('utf8-replacement.txt', b'A\xf0\x28\x8c\xbcB\xe2\x82', format='txt', encoding='utf-8', expected='A\ufffd(\ufffd\ufffdB\ufffd')
save('utf16-replacement.txt', b'\xff\xfeA\x00\x00\xd8B\x00C', format='txt', encoding='utf-16le', expected='A\ufffdB\ufffd')
save('empty.txt', b'', format='txt', encoding='utf-8', expected='')
save('bom-only.txt', b'\xef\xbb\xbf', format='txt', encoding='utf-8', expected='')
save('middle-bom.txt', '\ufeffA\ufeffB'.encode('utf-8'), format='txt', encoding='utf-8', expected='A\ufeffB')
save('opposite-bom.txt', b'\xfe\xffA\x00', format='txt', encoding='utf-16le', expected='\ufffeA')

book = '''<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
  <description><title-info><genre>sf</genre><author><nickname>Kana fixture</nickname></author><book-title>源位置试件</book-title><lang>zh</lang></title-info><document-info><author><nickname>Kana fixture</nickname></author><date value="2026-10-19">2026-10-19</date><id>kana-source-proof</id><version>1.0</version></document-info></description>
  <body>
    <section id="c1"><title><p>第一章</p></title><p id="merge">甲<!-- removed -->乙<![CDATA[丙😀]]><?reader ignored?>丁<![CDATA[]]>戊</p><p id="lines">A\r\nB\rC\nD&#13;E&#x1F600; é é</p><p id="mixed">前<strong>中😀</strong>後<emphasis>かな</emphasis>尾<a l:href="#n1" type="note">注</a></p><empty-line/></section>
    <section id="c2"><title><p>第二章</p></title><p id="last">結び𠮷\t終。</p></section>
  </body>
  <body name="notes"><section id="n1"><p>注記 &amp; 詳細</p></section></body>
</FictionBook>'''

def logical(node):
    children = []
    def add_text(value):
        if not value: return
        if children and children[-1]['kind'] == 'text': children[-1]['text'] += value
        else: children.append({'kind': 'text', 'text': value})
    add_text(node.text)
    for child in node:
        if isinstance(child.tag, str): children.append(logical(child))
        add_text(child.tail)
    return {'kind': 'element', 'name': etree.QName(node).localname,
            'namespace': etree.QName(node).namespace, 'children': children}

for name, data in [
    ('source.fb2', book.encode('utf-8')),
    ('source-utf16.fb2', book.replace('encoding="UTF-8"', 'encoding="UTF-16"').encode('utf-16')),
    ('internal-entity.fb2', book.replace('<FictionBook ', '<!DOCTYPE FictionBook [<!ENTITY word "内部😀">]>\n<FictionBook ', 1).replace('結び𠮷', '&word;').encode('utf-8'))]:
    parsed = etree.fromstring(data, etree.XMLParser(resolve_entities=True, no_network=True, remove_comments=False, remove_pis=False))
    schema.assertValid(parsed)
    save(name, data, format='fb2', encoding='utf-16le' if name == 'source-utf16.fb2' else 'utf-8',
         schemaValid=True, expectedTree=logical(parsed))

expectations = {'cases': cases, 'fixtureOrigin': 'self-authored controlled files; not published books'}
(CACHE / 'fixtures.json').write_text(json.dumps(expectations, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
write_receipt(HERE / 'fixture-input.json', {
    'recordedAt': datetime.now(timezone.utc).isoformat(), 'origin': expectations['fixtureOrigin'],
    'generatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'schema': {'repository': 'https://github.com/gribuser/fb2', 'commit': COMMIT, 'files': schema_files,
               'validator': {'lxml': etree.LXML_VERSION, 'libxml': etree.LIBXML_VERSION}},
    'cases': [{key: value for key, value in item.items() if key not in ['expected', 'expectedTree']} for item in cases],
    'expectationsSha256': hashlib.sha256((CACHE / 'fixtures.json').read_bytes()).hexdigest()
})
print(json.dumps({'txt': sum(item['format'] == 'txt' for item in cases), 'fb2': sum(item['format'] == 'fb2' for item in cases), 'schemaValidated': True}))
