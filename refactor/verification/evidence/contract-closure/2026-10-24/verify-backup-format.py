"""Check synthetic ZIP layout and exact tree bytes, without restoring user files."""
from pathlib import Path
import argparse
import hashlib
import io
import json
import subprocess
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--node', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=False)
checks = []

def check(name, condition):
    if not condition:
        raise AssertionError(name)
    checks.append(name)

def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')

def sha(value):
    return hashlib.sha256(value).hexdigest()

payload = '存档内容\n'.encode('utf-8')
entries = [
    {'path': '', 'type': 'directory'},
    {'path': 'empty', 'type': 'directory'},
    {'path': '存档.sav', 'type': 'file', 'sizeBytes': len(payload), 'sha256': sha(payload)},
]
rows = [[entry['path'], entry['type']] + ([entry['sizeBytes'], entry['sha256']] if entry['type'] == 'file' else []) for entry in entries]
check('Entry paths are in their declared UTF-8 order', [e['path'] for e in entries] == sorted([e['path'] for e in entries], key=lambda p: p.encode('utf-8')))
tree_bytes = encode(rows)
tree_digest = sha(tree_bytes)
manifest = {'format': 'kisaki-game-save', 'formatVersion': 1, 'entries': entries, 'treeDigest': tree_digest}
canonical_file = args.out / 'canonical-input.json'
canonical_file.write_bytes(tree_bytes)
script = "const fs=require('node:fs'); const value=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(JSON.stringify(value))"
process = subprocess.run([str(args.node), '-e', script, str(canonical_file)], capture_output=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
check('Node and Python produce the same canonical UTF-8 bytes', process.returncode == 0 and process.stdout == tree_bytes)
check('The empty directory has a fixed literal encoding', encode([['', 'directory']]) == b'[["","directory"]]')
check('Empty file and empty directory remain distinct', sha(encode([['', 'file', 0, sha(b'')]])) != sha(encode([['', 'directory']])))

archives = []
for name, compression, date, reverse in [
    ('stored', zipfile.ZIP_STORED, (2000, 1, 1, 0, 0, 0), False),
    ('deflated', zipfile.ZIP_DEFLATED, (2026, 10, 24, 0, 0, 0), True),
]:
    output = io.BytesIO()
    members = [('manifest.json', encode(manifest)), ('content/', b''), ('content/empty/', b''), ('content/存档.sav', payload)]
    with zipfile.ZipFile(output, 'w', allowZip64=True) as archive:
        for member, data in reversed(members) if reverse else members:
            info = zipfile.ZipInfo(member, date_time=date)
            info.compress_type = compression
            archive.writestr(info, data)
    data = output.getvalue()
    (args.out / (name + '.zip')).write_bytes(data)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        check(name + ': complete member set and CRCs', set(archive.namelist()) == {m for m, _ in members} and archive.testzip() is None)
        read_manifest = json.loads(archive.read('manifest.json'))
        check(name + ': manifest and ordinary file bytes round-trip', read_manifest == manifest and archive.read('content/存档.sav') == payload)
        check(name + ': non-ASCII member uses the UTF-8 flag', bool(archive.getinfo('content/存档.sav').flag_bits & 0x800))
    archives.append({'name': name, 'sha256': sha(data), 'treeDigest': tree_digest})
check('ZIP order, compression and timestamps do not define tree identity', archives[0]['sha256'] != archives[1]['sha256'] and archives[0]['treeDigest'] == archives[1]['treeDigest'])

result = {
    'checkedOn': '2026-10-24',
    'scope': 'Synthetic ZIP container and canonical encoding examples only; not production archive validation, ZIP64 limits, persistence barriers or recovery.',
    'checks': checks,
    'checkCount': len(checks),
    'treeRows': rows,
    'canonicalUtf8': tree_bytes.decode('utf-8'),
    'treeDigest': tree_digest,
    'archives': archives,
    'status': 'passed',
    'formalHostExecuted': False,
    'powerLossTested': False,
}
(args.out / 'backup-format-results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'checkCount': len(checks), 'status': 'passed', 'treeDigest': tree_digest}))
