from pathlib import Path, PurePosixPath
from io import BytesIO
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from concurrent.futures import ThreadPoolExecutor
import datetime
import hashlib
import json
import re
import shutil
import subprocess
import urllib.request
import zipfile
from lxml import etree

BASE = Path(__file__).resolve().parent
ROOT = BASE / 'fixtures'
SOURCE = json.loads((BASE / '2026-10-17-verification.json').read_text(encoding='utf-8'))
MANIFEST = json.loads((BASE / 'fixture-manifest.json').read_text(encoding='utf-8'))
TESTS = []

def check(name, actual, expected=True):
    if actual != expected:
        raise AssertionError(name + ': unexpected result')
    TESTS.append({'name': name, 'status': 'passed'})

class InputError(ValueError):
    pass

def rejects(name, run):
    try:
        run()
    except (InputError, etree.XMLSyntaxError, etree.DocumentInvalid, UnicodeError, ValueError, zipfile.BadZipFile):
        check(name, True)
        return
    raise AssertionError(name + ': input unexpectedly accepted')

# The text-normalization probe covers UTF-8 and BOM-marked UTF-16 fixtures.
def documents(data):
    if len(data) > 8 * 1024 * 1024:
        raise InputError('Fixture byte limit exceeded.')
    text = data.decode('utf-16' if data.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')
    if re.search(r'<!\s*(DOCTYPE|ENTITY)\b', text, re.I):
        raise InputError('DTD declarations are outside this input contract.')
    text = re.sub(r'^\s*<\?xml\s[^?]*\?>', '', text, count=1)
    parser = etree.XMLParser(resolve_entities=False, load_dtd=False, no_network=True, recover=False, huge_tree=False)
    wrapper = etree.fromstring(('<ProofRoot>' + text + '</ProofRoot>').encode('utf-8'), parser)
    if (wrapper.text or '').strip():
        raise InputError('Input has text outside its metadata root.')
    if any(isinstance(node, etree._ProcessingInstruction) for node in wrapper.iter()):
        raise InputError('XML processing instructions are outside this input contract.')
    children = [child for child in wrapper if isinstance(child.tag, str)]
    if any((child.tail or '').strip() for child in children):
        raise InputError('Input has trailing text outside metadata.')
    allowed = {'movie', 'tvshow', 'episodedetails', 'ComicInfo'}
    if not children or any(child.tag not in allowed for child in children):
        raise InputError('Unknown metadata root or namespace.')
    if len(children) > 1 and any(child.tag != 'episodedetails' for child in children):
        raise InputError('Only the legacy episode-fragment sequence is supported.')
    for root in children:
        for element in root.iter():
            if len(list(element.iterancestors())) > 32:
                raise InputError('Fixture XML depth limit exceeded.')
        if len(list(root.iter())) > 5000:
            raise InputError('Fixture node limit exceeded.')
    return children

def scalar(root, key):
    nodes = root.findall(key)
    if len(nodes) > 1:
        raise InputError('A scalar metadata field occurs more than once.')
    if not nodes:
        return None
    return ''.join(nodes[0].itertext()).strip() or None

def integer(text, minimum=0):
    if text is None or not re.fullmatch(r'[+-]?\d+', text):
        raise InputError('Expected an integer source value.')
    value = int(text)
    if value < minimum or value > 9007199254740991:
        raise InputError('Integer source value is outside its accepted range.')
    return value

def user_score(root):
    value = scalar(root, 'userrating')
    if value is None:
        return {'known': False}
    rating = integer(value)
    maximum = integer(root.find('userrating').get('max', '10'), 1)
    if rating > maximum:
        raise InputError('Personal rating exceeds its declared scale.')
    return {'known': True, 'value': None if rating == 0 else int((Decimal(rating) * 100 / maximum).quantize(Decimal('1'), rounding=ROUND_HALF_UP))}

def completion_snapshot(root, native_history_count=0):
    value = scalar(root, 'playcount')
    if value is None:
        return {'known': False}
    count = integer(value)
    if root.tag == 'tvshow':
        return {'known': False, 'reason': 'aggregate-current-episodes'}
    if root.tag == 'episodedetails':
        return {'known': True, 'partCompleted': count > 0}
    if root.tag != 'movie':
        return {'known': False}
    return {'known': True, 'initialCompletionCount': count if native_history_count == 0 else 0, 'completionDate': None, 'changesCurrentState': False}

def resume(root, actual_duration):
    node = root.find('resume')
    if node is None:
        return None
    position_text, total_text = scalar(node, 'position'), scalar(node, 'total')
    if position_text is None:
        return None
    try:
        position = Decimal(position_text)
        total = Decimal(total_text) if total_text is not None else Decimal(0)
    except InvalidOperation as error:
        raise InputError('Invalid source time.') from error
    if not position.is_finite() or not total.is_finite():
        raise InputError('Non-finite source time.')
    if position == 0 and total == 0:
        return None
    if position < 0 or total < 0 or position > Decimal(str(actual_duration)):
        raise InputError('Resume point is outside the actual file.')
    if total > 0 and (position > total or abs(total - Decimal(str(actual_duration))) > Decimal('0.25')):
        raise InputError('Source duration does not identify the verified timeline.')
    return {'positionSeconds': float(position)}

def partial_date(root):
    parts = [scalar(root, key) for key in ['Year', 'Month', 'Day']]
    year = integer(parts[0], 1) if parts[0] not in (None, '-1', '0') else None
    month = integer(parts[1], 1) if parts[1] not in (None, '-1', '0') else None
    day = integer(parts[2], 1) if parts[2] not in (None, '-1', '0') else None
    if year is None:
        if month is not None or day is not None:
            raise InputError('Date has no year.')
        return None
    if year > 9999 or (month is None and day is not None):
        raise InputError('Date precision is inconsistent.')
    if month is None:
        return str(year)
    datetime.date(year, month, day or 1)
    return f'{year:04d}-{month:02d}' + (f'-{day:02d}' if day is not None else '')

def isbn_from_gtin(value):
    if not re.fullmatch(r'(978|979)\d{10}', value or '') or value.startswith('9790'):
        return None
    digits = [int(character) for character in value]
    if sum(digit * (1 if index % 2 == 0 else 3) for index, digit in enumerate(digits)) % 10:
        raise InputError('ISBN checksum is invalid.')
    return value

def canonical_identity(root):
    known = []
    for element in root.findall('uniqueid'):
        kind, value = element.get('type'), (element.text or '').strip()
        if kind == 'tmdb' and root.tag == 'movie':
            known.append(('tmdb', 'movie/' + str(integer(value, 1))))
    if len({identity for identity in known}) > 1:
        raise InputError('Source identities conflict.')
    return known

def known_episode_identity(root, series, standard_order=False):
    if not standard_order:
        return None
    season = integer(scalar(root, 'season'))
    episode = integer(scalar(root, 'episode'))
    return ('tmdb', f'tv/{integer(str(series), 1)}/season/{season}/episode/{episode}')

def members(archive_path):
    with zipfile.ZipFile(archive_path) as archive:
        entries = archive.infolist()
        if len(entries) > 100 or sum(item.file_size for item in entries) > 8 * 1024 * 1024:
            raise InputError('Fixture archive budget exceeded.')
        normalized = []
        for item in entries:
            name = item.filename.replace('\\', '/')
            parts = PurePosixPath(name).parts
            if name.startswith('/') or '..' in parts or re.match(r'^[A-Za-z]:', name):
                raise InputError('Archive path escapes its root.')
            if item.flag_bits & 1:
                raise InputError('Encrypted archives are outside this proof.')
            normalized.append(name)
        if len(normalized) != len({name.casefold() for name in normalized}):
            raise InputError('Archive contains duplicate or case-conflicting member names.')
        metadata = [name for name in normalized if name.casefold() == 'comicinfo.xml']
        if len(metadata) != 1:
            raise InputError('Archive has no unique root metadata file.')
        data = {name: archive.read(item) for name, item in zip(normalized, entries) if not item.is_dir()}
    images = [name for name, value in data.items() if value.startswith(b'\x89PNG\r\n\x1a\n')]
    # Only simple ASCII numeric paths are covered by this sorting probe.
    if any(not re.fullmatch(r'[A-Za-z0-9_./-]+', name) for name in images):
        raise InputError('Archive member is outside the source-order probe.')
    ordered = sorted(images, key=lambda name: [int(part) if part.isdigit() else part.casefold() for part in re.split(r'(\d+)', name)])
    if len({name.casefold() for name in ordered}) != len(ordered):
        raise InputError('Page order has ambiguous case variants.')
    return documents(data[metadata[0]])[0], ordered, data

def page_position(page, ordered):
    index = integer(page.get('Image'))
    if index >= len(ordered):
        raise InputError('Page index is outside the paired archive.')
    return {'type': 'page', 'page': {'type': 'memberPath', 'path': ordered[index]}, 'point': {'x': 0, 'y': 0}}

def pair_nfo(nfo_path, candidates, family='same-basename'):
    basename = nfo_path.stem
    if family == 'episode-suffix':
        match = re.fullmatch(r'(.+)-S(\d+)E(\d+)', basename, re.I)
        if not match:
            raise InputError('Missing documented episode suffix.')
        basename = match.group(1)
    matches = [candidate for candidate in candidates if candidate.parent == nfo_path.parent and candidate.stem == basename]
    if len(matches) != 1:
        raise InputError('NFO has no unique paired media file.')
    return matches[0]

before = {item['path']: hashlib.sha256((ROOT / item['path']).read_bytes()).hexdigest() for item in MANIFEST['files']}
schema_sources = [item for item in SOURCE['sourceFiles'] if item['file'].endswith('ComicInfo.xsd')]
def load_schema(item):
    with urllib.request.urlopen(item['url'], timeout=25) as response:
        data = response.read(1024 * 1024)
    if hashlib.sha256(data).hexdigest() != item['sha256']:
        raise InputError('Pinned schema checksum mismatch.')
    parser = etree.XMLParser(resolve_entities=False, load_dtd=False, no_network=True)
    return item['file'], etree.XMLSchema(etree.fromstring(data, parser))
with ThreadPoolExecutor(max_workers=3) as pool:
    schemas = dict(pool.map(load_schema, schema_sources))
for version, filename in [('1.0', 'v1'), ('2.0', 'v2'), ('2.1', 'v21')]:
    schema = schemas[('drafts' if version == '2.1' else 'schema') + '/v' + version + '/ComicInfo.xsd']
    schema.assertValid(etree.parse(str(ROOT / f'comic/{filename}-ComicInfo.xml')))
    check('Synthetic ComicInfo ' + version + ' validates against its pinned XSD', True)
rejects('Version 1.0 does not accept the 2.0 right-to-left value', lambda: schemas['schema/v1.0/ComicInfo.xsd'].assertValid(etree.fromstring(b'<ComicInfo><Manga>YesAndRightToLeft</Manga></ComicInfo>')))
rejects('Version 2.0 does not silently accept draft Tags', lambda: schemas['schema/v2.0/ComicInfo.xsd'].assertValid(etree.fromstring(b'<ComicInfo><Tags>Selected</Tags></ComicInfo>')))
rejects('Draft 2.1 reduces community-rating precision to one decimal', lambda: schemas['drafts/v2.1/ComicInfo.xsd'].assertValid(etree.fromstring(b'<ComicInfo><CommunityRating>4.75</CommunityRating></ComicInfo>')))
rejects('Official schema rejects duplicate scalar fields', lambda: schemas['schema/v2.0/ComicInfo.xsd'].assertValid(etree.fromstring(b'<ComicInfo><Title>A</Title><Title>B</Title></ComicInfo>')))
movie = documents((ROOT / 'movie/星海.nfo').read_bytes())[0]
tvshow = documents((ROOT / 'series/tvshow.nfo').read_bytes())[0]
episodes = documents((ROOT / 'series/合集 S01E01E02.nfo').read_bytes())
comic1 = documents((ROOT / 'comic/v1-ComicInfo.xml').read_bytes())[0]
comic2 = documents((ROOT / 'comic/v2-ComicInfo.xml').read_bytes())[0]
comic21 = documents((ROOT / 'comic/v21-ComicInfo.xml').read_bytes())[0]
check('Movie root remains a movie input', movie.tag, 'movie')
check('Legacy multi-episode fragment parses two distinct records', len(episodes), 2)
check('New suffix NFO contains one episode', len(documents((ROOT / 'series/合集 S01E01E02-S01E01.nfo').read_bytes())), 1)
check('UTF-16 metadata preserves the same title', scalar(documents((ROOT / 'comic/utf16-ComicInfo.xml').read_bytes())[0], 'Title'), scalar(comic2, 'Title'))
check('Known fields can be read despite non-semantic field order', scalar(documents((ROOT / 'comic/reordered.xml').read_bytes())[0], 'Title'), 'Book')
check('XML entities decode to their actual text', scalar(movie, 'plot'), '第一段。\n\n第二段 & 原样文字。')
rejects('Stylesheet processing instructions cannot add external actions', lambda: documents(b'<?xml-stylesheet href="https://example.invalid/style"?><movie><title>A</title></movie>'))
rejects('Malformed XML is rejected', lambda: documents((ROOT / 'invalid/malformed.nfo').read_bytes()))
rejects('External entity document is rejected before expansion', lambda: documents((ROOT / 'invalid/entity.nfo').read_bytes()))
rejects('Unrelated XML namespace is rejected', lambda: documents((ROOT / 'invalid/namespaced.xml').read_bytes()))
rejects('A URL-only NFO is outside metadata input', lambda: documents(b'https://example.invalid/movie/1'))
rejects('Mixed movie and episode roots are rejected', lambda: documents(b'<movie/><episodedetails/>'))
rejects('Trailing scraper URL is not an implicit network instruction', lambda: documents(b'<movie><title>A</title></movie>https://example.invalid'))
rejects('Duplicate scalar field is not a last-value override', lambda: scalar(documents(b'<movie><title>A</title><title>B</title></movie>')[0], 'title'))
check('Explicit NFO user rating maps to eighty', user_score(movie), {'known': True, 'value': 80})
check('Public rating never replaces missing personal rating', user_score(documents(b'<movie><ratings><rating><value>9.8</value></rating></ratings></movie>')[0]), {'known': False})
check('Zero means explicitly unrated', user_score(documents(b'<movie><userrating>0</userrating></movie>')[0]), {'known': True, 'value': None})
check('Empty personal rating in a template is unknown', user_score(documents(b'<movie><userrating/></movie>')[0]), {'known': False})
check('Explicit rating scale is normalized without integer-division loss', user_score(documents(b'<movie><userrating max="100">75</userrating></movie>')[0]), {'known': True, 'value': 75})
rejects('Out-of-range personal rating is rejected', lambda: user_score(documents(b'<movie><userrating>11</userrating></movie>')[0]))
rejects('Unknown fractional source user rating is not rounded to a Kodi integer', lambda: user_score(documents(b'<movie><userrating>7.5</userrating></movie>')[0]))
check('Movie watched count initializes three unknown-date completions', completion_snapshot(movie), {'known': True, 'initialCompletionCount': 3, 'completionDate': None, 'changesCurrentState': False})
check('Existing history is not appended from an aggregate count', completion_snapshot(movie, 1)['initialCompletionCount'], 0)
check('TV show all-current-episodes flag is not a Work completion', completion_snapshot(tvshow)['known'], False)
check('Episode watched count becomes one Part flag', completion_snapshot(episodes[0]), {'known': True, 'partCompleted': True})
check('Episode zero is a real false flag, not missing data', completion_snapshot(episodes[1]), {'known': True, 'partCompleted': False})
rejects('Negative watched count is rejected', lambda: completion_snapshot(documents(b'<movie><playcount>-1</playcount></movie>')[0]))
check('Last played is not used as a completion date', completion_snapshot(movie)['completionDate'], None)
check('Runtime remains declaration in minutes', integer(scalar(movie, 'runtime')) * 60000, 5400000)
check('Known movie identity includes its resource kind', canonical_identity(movie), [('tmdb', 'movie/123456789')])
check('Untyped legacy id is not a public identity', canonical_identity(documents(b'<movie><id>123</id></movie>')[0]), [])
check('TV series identity is not attached to a season Work', canonical_identity(tvshow), [])
check('Bare episode TMDB ID is not a complete native identity', canonical_identity(episodes[0]), [])
check('Unknown numbering order does not manufacture TMDB coordinates', known_episode_identity(episodes[0], 456), None)
check('Explicit standard numbering and real series context form complete coordinates', known_episode_identity(episodes[0], 456, True), ('tmdb', 'tv/456/season/1/episode/1'))
rejects('Conflicting movie identities are reported', lambda: canonical_identity(documents(b'<movie><uniqueid type="tmdb">1</uniqueid><uniqueid type="tmdb">2</uniqueid></movie>')[0]))
check('Comic Number is preserved as a string label', scalar(comic21, 'Number'), '1.5')
check('Comic Volume 2018 remains publication-run context', scalar(comic21, 'Volume'), '2018')
check('Partial publication date keeps month precision', partial_date(comic1), '2020-01')
check('Actual first day remains an exact legal date', partial_date(comic2), '2020-01-01')
check('Sentinel unknown date does not become year one', partial_date(documents(b'<ComicInfo><Year>-1</Year><Month>-1</Month></ComicInfo>')[0]), None)
rejects('Invalid calendar day is rejected', lambda: partial_date(documents(b'<ComicInfo><Year>2026</Year><Month>2</Month><Day>30</Day></ComicInfo>')[0]))
check('Known ISBN-form GTIN is retained with checksum', isbn_from_gtin(scalar(comic21, 'GTIN')), '9781234567897')
check('A generic product code is not reclassified as ISBN', isbn_from_gtin('1234567890128'), None)
check('An ISMN prefix is not reclassified as ISBN', isbn_from_gtin('9790123456785'), None)
rejects('Bad ISBN checksum is rejected', lambda: isbn_from_gtin('9781234567890'))
check('Comic community rating is not a user rating', user_score(comic21), {'known': False})
check('ComicInfo has no standard read count or last-page fields', {key: scalar(comic21, key) for key in ['ReadCount', 'LastPageRead', 'ReadPercentage']}, {'ReadCount': None, 'LastPageRead': None, 'ReadPercentage': None})
check('Draft story-arc names and ordinals stay positional input pairs', list(zip(scalar(comic21, 'StoryArc').split(', '), scalar(comic21, 'StoryArcNumber').split(', '))), [('前篇', '2'), ('支线', '1')])
check('Creator field retains a possible organization', scalar(comic21, 'Writer'), '作者甲, 创作组合乙')
check('Book language is retained without claiming original language', scalar(comic21, 'LanguageISO'), 'zh-Hans')
check('Space-delimited Web URLs preserve encoded spaces', scalar(comic21, 'Web').split(), ['https://example.invalid/book/1', 'https://example.invalid/book/1?title=A%20B'])
archive_metadata, order, archive_data = members(ROOT / 'comic/book.cbz')
check('Actual CBZ page order follows the bounded source probe', order, ['pages/1.png', 'pages/2.png', 'pages/10.png'])
check('Bookmark Image 2 selects the third image, not the first XML Page node position', page_position(archive_metadata.find('Pages/Page'), order)['page']['path'], 'pages/10.png')
front = next(page for page in archive_metadata.findall('Pages/Page') if page.get('Type') == 'FrontCover')
check('Explicit front-cover image resolves to an actual member', page_position(front, order)['page']['path'], 'pages/1.png')
check('Source deleted-page flag never removes the underlying image', 'pages/2.png' in archive_data, True)
rejects('Duplicate metadata candidates in one archive are ambiguous', lambda: members(ROOT / 'comic/ambiguous.cbz'))
def case_conflicting_archive():
    stream = BytesIO()
    with zipfile.ZipFile(stream, 'w') as archive:
        archive.writestr('ComicInfo.xml', b'<ComicInfo/>')
        archive.writestr('pages/1.png', b'first')
        archive.writestr('pages/1.PNG', b'second')
    stream.seek(0)
    return members(stream)
rejects('Case-conflicting image members cannot be silently collapsed', case_conflicting_archive)
rejects('Archive traversal member is rejected', lambda: members(ROOT / 'comic/traversal.cbz'))
rejects('Negative image index is rejected', lambda: page_position(etree.fromstring(b'<Page Image="-1"/>'), order))
rejects('Out-of-bounds image index is not clipped', lambda: page_position(etree.fromstring(b'<Page Image="3"/>'), order))
video = ROOT / 'movie/星海.mkv'
ffprobe = shutil.which('ffprobe')
if not ffprobe:
    raise RuntimeError('The proof requires an installed ffprobe executable.')
probe = json.loads(subprocess.check_output([ffprobe, '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', str(video)], text=True, encoding='utf-8'))
duration = float(probe['format']['duration'])
check('Actual generated movie has a two-second timeline', duration, 2.0)
check('Actual generated movie has a video stream', any(stream['codec_type'] == 'video' for stream in probe['streams']), True)
check('Fractional source seconds identify a position on the actual file', resume(movie, duration), {'positionSeconds': 1.25})
check('Positive resume does not require an optional source total', resume(documents(b'<movie><resume><position>1</position></resume></movie>')[0], duration), {'positionSeconds': 1.0})
check('Zero unknown total does not discard a valid positive resume', resume(documents(b'<movie><resume><position>1</position><total>0</total></resume></movie>')[0], duration), {'positionSeconds': 1.0})
check('Default zero resume does not clear an existing position', resume(documents(b'<movie><resume><position>0</position><total>0</total></resume></movie>')[0], duration), None)
rejects('Out-of-file resume point is rejected', lambda: resume(documents(b'<movie><resume><position>3</position><total>3</total></resume></movie>')[0], duration))
rejects('Different source timeline is not proportionally rescaled', lambda: resume(documents(b'<movie><resume><position>1</position><total>30</total></resume></movie>')[0], duration))
rejects('Non-finite resume point is rejected', lambda: resume(documents(b'<movie><resume><position>NaN</position><total>2</total></resume></movie>')[0], duration))
check('Same-basename NFO resolves its explicit adjacent video', pair_nfo(ROOT / 'movie/星海.nfo', [video]), video)
check('Documented episode suffix resolves the shared multi-episode video', pair_nfo(ROOT / 'series/合集 S01E01E02-S01E01.nfo', [ROOT / 'series/合集 S01E01E02.mkv'], 'episode-suffix'), ROOT / 'series/合集 S01E01E02.mkv')
rejects('Multiple same-basename formats need explicit pairing', lambda: pair_nfo(ROOT / 'movie/星海.nfo', [video, ROOT / 'movie/星海.mp4']))
check('Conflicting multi-episode resume points remain distinct inputs', len({resume(episode, duration)['positionSeconds'] for episode in episodes}), 2)
for item in MANIFEST['files']:
    check('Source fixture remains unchanged: ' + item['path'], before[item['path']] == item['sha256'] == hashlib.sha256((ROOT / item['path']).read_bytes()).hexdigest())
result = {'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'status': 'passed', 'syntheticOnly': True, 'total': len(TESTS), 'runtime': {'lxml': list(etree.LXML_VERSION), 'libxml': list(etree.LIBXML_VERSION), 'videoDurationSeconds': duration}, 'limitations': ['No real user export, source application, or production Kisaki migration was exercised.', 'XML text probe covers UTF-8 and BOM-marked UTF-16.', 'ComicRack page-order probe covers simple ASCII numeric member names only.', 'Resume tolerance is a synthetic fixture check, not the final player timing policy.', 'Pinned XSD validation complements field parsing; schema field order is not treated as a production import requirement.'], 'tests': TESTS}
(BASE / 'synthetic-results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'status': result['status'], 'passed': len(TESTS), 'syntheticOnly': True}))
