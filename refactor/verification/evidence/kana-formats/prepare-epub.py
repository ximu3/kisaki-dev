"""Create a small real EPUB container for source occurrence and CFI edge cases."""
from pathlib import Path
import hashlib
import json
import sys
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CACHE = ROOT / 'node_modules/.cache/kana-formats'
sys.path.insert(0, str(HERE.parent / 'kana-rar'))
from record import write_receipt
documents = {
    'META-INF/container.xml': '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    'EPUB/package.opf': '''<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">kana-cfi-proof</dc:identifier><dc:title>CFI source proof</dc:title><dc:language>zh</dc:language><meta property="dcterms:modified">2026-10-19T00:00:00Z</meta></metadata><manifest><item id="c1" href="one.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="two.xhtml" media-type="application/xhtml+xml"/><item id="svg" href="diagram.svg" media-type="image/svg+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref id="r1" idref="c1"/><itemref id="r2" idref="c1"/><itemref id="r3" idref="c2"/></spine></package>''',
    'EPUB/one.xhtml': '''<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>一</title></head><body><p id="p,[x];=^">甲<!--omit-->乙<![CDATA[😀]]><?omit x?>丙<strong>中</strong>後</p><p id="gaps"><em>A</em><b>B</b></p><object data="diagram.svg#figure" type="image/svg+xml"/><p id="percent%20literal">終</p></body></html>''',
    'EPUB/two.xhtml': '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>二</title></head><body><p id="last">結び𠮷</p></body></html>',
    'EPUB/diagram.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g id="figure"><text x="0" y="20">図</text></g></svg>',
    'EPUB/nav.xhtml': '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目次</title></head><body><nav epub:type="toc"><ol><li><a href="one.xhtml">一</a></li><li><a href="two.xhtml">二</a></li></ol></nav></body></html>'
}
file = CACHE / 'source.epub'
with zipfile.ZipFile(file, 'w') as archive:
    mime = zipfile.ZipInfo('mimetype', (2026, 10, 19, 0, 0, 0))
    archive.writestr(mime, 'application/epub+zip')
    for name, content in documents.items():
        info = zipfile.ZipInfo(name, (2026, 10, 19, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, content.encode('utf-8'))
(CACHE / 'epub-documents.json').write_text(json.dumps(documents, ensure_ascii=False), encoding='utf-8')
write_receipt(HERE / 'epub-fixture-input.json', {'origin': 'self-authored controlled EPUB container',
    'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'bytes': file.stat().st_size,
    'documents': {name: hashlib.sha256(content.encode('utf-8')).hexdigest() for name, content in documents.items()},
    'externalEpubCheckExecuted': False})
