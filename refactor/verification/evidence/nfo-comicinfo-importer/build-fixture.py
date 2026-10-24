from pathlib import Path
import hashlib
import json
import shutil
import struct
import subprocess
import zlib
import zipfile
from xml.etree.ElementTree import Element, SubElement, tostring

BASE = Path(__file__).resolve().parent
ROOT = BASE / 'fixtures'
ORDER = json.loads((BASE / 'field-order.json').read_text(encoding='utf-8'))
files = []

def write(relative, content):
    target = (ROOT / relative).resolve()
    target.relative_to(ROOT.resolve())
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    files.append(relative)
    return target

def png(color):
    def chunk(kind, value):
        return struct.pack('>I', len(value)) + kind + value + struct.pack('>I', zlib.crc32(kind + value) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes([0, *color]))) + chunk(b'IEND', b'')

def comic(version, values, pages):
    root = Element('ComicInfo')
    for key in ORDER[version]:
        if key == 'Pages':
            node = SubElement(root, 'Pages')
            for page in pages:
                SubElement(node, 'Page', page)
        elif key in values:
            SubElement(root, key).text = values[key]
    return b'<?xml version="1.0" encoding="utf-8"?>\n' + tostring(root, encoding='utf-8')

movie = '''<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <title>星海的约定</title><originaltitle>星海の約束</originaltitle>
  <ratings><rating name="public" max="10" default="true"><value>9.4</value><votes>500</votes></rating></ratings>
  <userrating>8</userrating><plot>第一段。&#10;&#10;第二段 &amp; 原样文字。</plot>
  <runtime>90</runtime><playcount>3</playcount><lastplayed>2026-09-15</lastplayed>
  <uniqueid type="tmdb" default="true">123456789</uniqueid><id>local-default-id</id>
  <genre>动画</genre><genre>科幻</genre><tag>重看</tag>
  <set><name>星海系列</name><overview>来源合辑说明。</overview></set>
  <premiered>2020-01-01</premiered><studio>来源制作组</studio>
  <actor><name>同名演员</name><role>角色名 (voice)</role></actor>
  <thumb aspect="poster">星海-poster.png</thumb><fanart><thumb>星海-fanart.png</thumb></fanart>
  <resume><position>1.25</position><total>2</total></resume>
  <streamdetails><video><durationinseconds>9999</durationinseconds></video></streamdetails>
</movie>'''
write('movie/星海.nfo', movie.encode('utf-8'))
write('movie/星海-poster.png', png((25, 35, 60)))
write('movie/星海-fanart.png', png((70, 95, 130)))
write('series/tvshow.nfo', '''<tvshow><title>星海合集</title><uniqueid type="tmdb">456</uniqueid><plot>整剧简介。</plot><season>2</season><episode>24</episode><playcount>1</playcount><userrating>9</userrating><namedseason number="1">第一季</namedseason><namedseason number="2">第二季</namedseason></tvshow>'''.encode('utf-8'))

def episode(number, count, position):
    return '<episodedetails><title>第' + str(number) + '集</title><season>1</season><episode>' + str(number) + '</episode><uniqueid type="tmdb">' + str(900 + number) + '</uniqueid><userrating>8</userrating><playcount>' + str(count) + '</playcount><lastplayed>2026-09-16</lastplayed><aired>2020-01-01</aired><resume><position>' + str(position) + '</position><total>2</total></resume></episodedetails>'
write('series/合集 S01E01E02.nfo', ('<?xml version="1.0" encoding="UTF-8"?>\n' + episode(1, 2, 1.25) + '\n' + episode(2, 0, 0.5)).encode('utf-8'))
write('series/合集 S01E01E02-S01E01.nfo', episode(1, 2, 1.25).encode('utf-8'))
write('series/合集 S01E01E02-S01E02.nfo', episode(2, 0, 0.5).encode('utf-8'))
values = {'Title': '起点', 'Series': '星光记事', 'Number': '1.5', 'Count': '12', 'Volume': '2018', 'Summary': '这一本书的简介。', 'Notes': '由合成夹具生成的来源说明。', 'Year': '2020', 'Month': '1', 'Writer': '作者甲, 创作组合乙', 'Penciller': '绘者丙', 'Publisher': '出版者或个人', 'Genre': '校园, 日常', 'Web': 'https://example.invalid/book/1 https://example.invalid/book/1?title=A%20B', 'PageCount': '3', 'LanguageISO': 'zh-Hans', 'Format': 'Tankobon', 'Manga': 'Yes'}
v1 = comic('1.0', values, [{'Image': '0', 'Type': 'FrontCover'}, {'Image': '1'}, {'Image': '2'}])
v2values = {**values, 'Day': '1', 'Manga': 'YesAndRightToLeft', 'CommunityRating': '4.75', 'Review': '来源书评，作者身份未声明。', 'SeriesGroup': '珍藏', 'StoryArc': '前篇'}
v2 = comic('2.0', v2values, [{'Image': '2', 'Bookmark': '后记'}, {'Image': '0', 'Type': 'FrontCover'}, {'Image': '1', 'Bookmark': '喜欢的场景'}])
v21values = {**v2values, 'CommunityRating': '4.7', 'Translator': '译组丁', 'Tags': '重读, 纸质版', 'StoryArc': '前篇, 支线', 'StoryArcNumber': '2, 1', 'GTIN': '9781234567897'}
v21 = comic('2.1-draft', v21values, [{'Image': '2', 'Bookmark': '后记'}, {'Image': '0', 'Type': 'FrontCover'}, {'Image': '1', 'Type': 'Deleted', 'Bookmark': '保留的标记'}])
write('comic/v1-ComicInfo.xml', v1)
write('comic/v2-ComicInfo.xml', v2)
write('comic/v21-ComicInfo.xml', v21)
write('comic/utf16-ComicInfo.xml', ('<?xml version="1.0" encoding="UTF-16"?>\n' + v2.decode('utf-8').split('\n', 1)[1]).encode('utf-16'))
write('comic/reordered.xml', b'<ComicInfo><Series>Series</Series><Title>Book</Title></ComicInfo>')
write('invalid/entity.nfo', b'<!DOCTYPE movie [<!ENTITY payload SYSTEM "https://example.invalid/never-request">]><movie><title>&payload;</title></movie>')
write('invalid/malformed.nfo', b'<movie><title>Broken</movie>')
write('invalid/namespaced.xml', b'<ComicInfo xmlns="urn:unrelated"><Title>Wrong namespace</Title></ComicInfo>')
images = {'pages/10.png': png((0, 0, 255)), 'pages/2.png': png((0, 255, 0)), 'pages/1.png': png((255, 0, 0))}
for archive_name, extra in [('book.cbz', {'ComicInfo.xml': v21}), ('ambiguous.cbz', {'ComicInfo.xml': v2, 'comicinfo.xml': v21}), ('traversal.cbz', {'ComicInfo.xml': v21, '../escape.png': png((0, 0, 0))})]:
    destination = write('comic/' + archive_name, b'')
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name, content in {**images, **extra}.items():
            info = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, content)

ffmpeg = shutil.which('ffmpeg')
if not ffmpeg:
    raise RuntimeError('The fixture requires an installed ffmpeg executable.')
video = (ROOT / 'movie/星海.mkv').resolve()
video.relative_to(ROOT.resolve())
subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:d=2:r=4', '-c:v', 'mpeg4', '-q:v', '10', '-an', '-y', str(video)], check=True)
files.append('movie/星海.mkv')
write('series/合集 S01E01E02.mkv', video.read_bytes())
manifest = {'syntheticOnly': True, 'files': [{'path': relative, 'bytes': (ROOT / relative).stat().st_size, 'sha256': hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()} for relative in files]}
(BASE / 'fixture-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'syntheticOnly': True, 'files': len(files)}, ensure_ascii=False))
