"""Build declaration and signature cases without borrowing the candidate's decoder."""
from pathlib import Path
from datetime import datetime, timezone
import base64
import hashlib
import json

HERE = Path(__file__).resolve().parent
CACHE = HERE.parents[3] / 'node_modules/.cache'
output = CACHE / 'kana-xml-entry/fixtures.json'
previous = json.loads((CACHE / 'kana-xml-codecs/fixtures.json').read_text(encoding='utf-8'))
cases = []

def add(name, data, *, text=None, code=None, reason=None, route=None, canonical=None, options=None):
    cases.append({'name': name, 'bytes': base64.b64encode(data).decode(), 'length': len(data),
                  'sha256': hashlib.sha256(data).hexdigest(),
                  **({'text': text} if text is not None else {}),
                  **({'code': code} if code else {}), **({'reason': reason} if reason else {}),
                  **({'route': route} if route else {}), **({'canonical': canonical} if canonical else {}),
                  **({'options': options} if options else {})})

for case in previous['cases']:
    cases.append({**case, 'name': 'encoded-' + case['name']})
utf8 = lambda text: text.encode('utf-8')
add('default-utf8', utf8('<r>甲😀</r>'), text='甲😀', route='native', canonical='UTF-8')
add('utf8-bom', b'\xef\xbb\xbf' + utf8('<r>甲😀</r>'), text='甲😀', route='native')
add('declaration-version-only', utf8('<?xml version="1.0"?><r>A</r>'), text='A', route='native')
add('not-a-declaration', utf8('<?xml-stylesheet type="text/css" href="local.css"?><r>A</r>'), text='A', route='native')
add('case-and-whitespace', utf8("<?xml\tversion = '1.0'\nencoding = 'uTf-8' standalone='yes' ?><r>A</r>"), text='A', route='native')
add('ascii-alias', utf8('<?xml version="1.0" encoding="csASCII"?><r>A</r>'), text='A', route='native', canonical='US-ASCII')
add('latin1-alias', '<?xml version="1.0" encoding="latin1"?><r>é\u0080</r>'.encode('latin1'), text='é\u0080', route='native', canonical='ISO-8859-1')
add('windows-alias', '<?xml version="1.0" encoding="windows-1251"?><r>Привет</r>'.encode('cp1251'), text='Привет', route='transcode', canonical='CP1251')
add('cp932-corrected', '<?xml version="1.0" encoding="CP932"?><r>～</r>'.encode('cp932'), text='～', route='transcode', canonical='CP932')
for endian in ['le', 'be']:
    bom = b'\xff\xfe' if endian == 'le' else b'\xfe\xff'
    data = '<?xml version="1.0" encoding="UTF-16"?><r>甲😀</r>'.encode('utf-16' + endian)
    add('utf16-' + endian, bom + data, text='甲😀', route='native', canonical='UTF-16')
    add('utf16-implicit-' + endian, bom + '<r>甲😀</r>'.encode('utf-16' + endian), text='甲😀', route='native')
    add('utf16-no-bom-' + endian, data, code='invalidDocument', reason='missingUtf16Bom')
    add('utf16-conflict-' + endian, bom + '<?xml version="1.0" encoding="UTF-8"?><r>A</r>'.encode('utf-16' + endian), code='invalidDocument', reason='encodingConflict')
    other = 'BE' if endian == 'le' else 'LE'
    add('endian-conflict-' + endian, bom + ('<?xml version="1.0" encoding="UTF-16' + other + '"?><r>A</r>').encode('utf-16' + endian), code='invalidDocument', reason='byteOrderConflict')
    bom32 = b'\xff\xfe\0\0' if endian == 'le' else b'\0\0\xfe\xff'
    add('utf32-' + endian, bom32 + '<?xml version="1.0" encoding="UTF-32"?><r>甲😀</r>'.encode('utf-32' + endian), text='甲😀', route='transcode', canonical='UTF-32')
    add('utf32-no-declaration-' + endian, bom32 + '<r>A</r>'.encode('utf-32' + endian), code='invalidDocument', reason='missingEncodingDeclaration')
add('utf8-bom-conflict', b'\xef\xbb\xbf' + utf8('<?xml version="1.0" encoding="ISO-8859-1"?><r>A</r>'), code='invalidDocument', reason='encodingConflict')
add('double-utf8-bom', b'\xef\xbb\xbf' * 2 + utf8('<r>A</r>'), code='invalidDocument')
for name, declaration in [
    ('unknown-codec', 'encoding="unknown-codec"'), ('prototype-name', 'encoding="constructor"'),
    ('locale-char', 'encoding="CHAR"'),
    ('native-wchar', 'encoding="WCHAR_T"'), ('internal-ucs', 'encoding="UCS-2-INTERNAL"'),
    ('java-escape-codec', 'encoding="JAVA"'), ('c99-escape-codec', 'encoding="C99"'),
    ('empty-encoding', 'encoding=""'), ('ignore-suffix', 'encoding="UTF-8//IGNORE"'),
    ('reordered-declaration', 'standalone="yes" encoding="UTF-8"'),
    ('duplicate-encoding', 'encoding="UTF-8" encoding="UTF-8"')
]:
    syntax = name in ['empty-encoding', 'ignore-suffix', 'reordered-declaration', 'duplicate-encoding']
    add(name, utf8('<?xml version="1.0" ' + declaration + '?><r>A</r>'),
        code='invalidDocument' if syntax else 'unsupportedFeature',
        reason='declarationSyntax' if syntax else 'unknownEncoding')
for name, text in [
    ('unfinished-declaration', '<?xml version="1.0"'),
    ('missing-version', '<?xml encoding="UTF-8"?><r>A</r>'),
    ('leading-whitespace-declaration', ' <?xml version="1.0"?><r>A</r>'),
    ('second-declaration', '<?xml version="1.0"?><?xml version="1.0"?><r>A</r>'),
    ('non-ascii-encoding-name', '<?xml version="1.0" encoding="编码"?><r>A</r>'),
    ('missing-root', '<?xml version="1.0"?>')
]:
    add(name, utf8(text), code='invalidDocument')
add('xml-1.1', utf8('<?xml version="1.1"?><r>A</r>'), code='unsupportedFeature', reason='xmlVersion')
add('invalid-default-utf8', b'<r>\xc0\xaf</r>', code='invalidDocument')
add('truncated-transcoded-byte', b'<?xml version="1.0" encoding="Shift_JIS"?><r>\x82', code='invalidDocument', reason='invalidEncoding')
add('invalid-xml-after-transcoding', b'<?xml version="1.0" encoding="windows-1252"?><r><b>A</r>', code='invalidDocument', reason='xmlSyntax')
add('unsupported-ucs-order', b'\x00\x00\xff\xfe' + b'\x00\x00<\x00', code='unsupportedFeature', reason='unsupportedByteOrder')
add('unsupported-ebcdic', bytes.fromhex('4c6fa794'), code='unsupportedFeature', reason='unsupportedEbcdic')
add('epub-utf8', utf8('<?xml version="1.0" encoding="UTF-8"?><r>A</r>'), text='A', route='native', options={'format': 'epub'})
add('epub-non-unicode', b'<?xml version="1.0" encoding="windows-1252"?><r>A</r>', code='invalidDocument', reason='epubEncoding', options={'format': 'epub'})
add('epub-utf32', b'\xff\xfe\0\0' + '<?xml version="1.0" encoding="UTF-32"?><r>A</r>'.encode('utf-32le'), code='invalidDocument', reason='epubEncoding', options={'format': 'epub'})
add('declaration-budget', utf8('<?xml ' + ' ' * 200 + 'version="1.0"?><r>A</r>'), code='resourceLimit', reason='declaration', options={'declarationLimit': 64})
add('source-budget', utf8('<r>' + 'A' * 512 + '</r>'), code='resourceLimit', reason='source', options={'sourceLimit': 64})
add('expanded-text-budget', utf8('<r>' + 'A' * 512 + '</r>'), code='resourceLimit', options={'text': 32})
add('transcoded-output-budget', ('<?xml version="1.0" encoding="windows-1251"?><r>' + 'Я' * 128 + '</r>').encode('cp1251'), code='resourceLimit', reason='resourceLimit', options={'decodedLimit': 64})
public = '-//W3C//DTD XHTML 1.1//EN'
xml = '<?xml version="1.0"?><!DOCTYPE html PUBLIC "' + public + '" "local.dtd"><html xmlns="http://www.w3.org/1999/xhtml"><body>A&nbsp;B&copy;</body></html>'
add('local-catalog', utf8(xml), text='A\u00a0B©', route='native', options={'format': 'epub'})
add('used-external-entity', utf8('<!DOCTYPE r [<!ENTITY ext SYSTEM "https://source.invalid/ext">]><r>left&ext;right</r>'), code='invalidDocument')

report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'cases': cases}
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
receipt = {'checkedAt': report['checkedAt'], 'cases': len(cases),
           'previousFixturesSha256': hashlib.sha256((CACHE / 'kana-xml-codecs/fixtures.json').read_bytes()).hexdigest(),
           'fixturesSha256': hashlib.sha256(output.read_bytes()).hexdigest(),
           'scriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'syntheticOnly': True}
(HERE / 'source-input.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'cases': len(cases)}))
