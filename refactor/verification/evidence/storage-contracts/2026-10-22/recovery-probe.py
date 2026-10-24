"""Exercise recovery decisions with disposable NTFS files and abrupt child exits."""

from pathlib import Path
import ctypes
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import uuid


CRASH_EXIT = 73


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def digest(path):
    if not path.exists():
        return None
    if path.is_symlink():
        raise ValueError('Links are outside this probe')
    rows = []
    for item in [path, *sorted(path.rglob('*'), key=lambda p: p.relative_to(path).as_posix().encode())] if path.is_dir() else [path]:
        if item.is_symlink():
            raise ValueError('Links are outside this probe')
        relative = '' if item == path else item.relative_to(path).as_posix()
        if item.is_dir():
            rows.append([relative, 'directory'])
        else:
            data = item.read_bytes()
            rows.append([relative, 'file', len(data), hashlib.sha256(data).hexdigest()])
    return hashlib.sha256(encode(rows)).hexdigest()


def owned(root, path):
    base, resolved = root.resolve(), path.resolve()
    if resolved == base or not resolved.is_relative_to(base):
        raise ValueError('Path is outside the disposable case')
    return resolved


def move_absent(root, source, target):
    source, target = owned(root, source), owned(root, target)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    move = kernel.MoveFileExW
    move.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_uint32]
    move.restype = ctypes.c_int
    # No REPLACE_EXISTING or COPY_ALLOWED flags are used.
    if not move(str(source), str(target), 0x8):
        raise ctypes.WinError(ctypes.get_last_error())


def write_durable(path, value):
    with path.open('wb') as file:
        file.write(encode(value))
        file.flush()
        os.fsync(file.fileno())


def connect(root):
    connection = sqlite3.connect(root / 'index.sqlite')
    connection.execute('PRAGMA journal_mode=WAL')
    connection.execute('PRAGMA synchronous=FULL')
    return connection


def checkpoint(requested, name):
    if requested == name:
        os._exit(CRASH_EXIT)


def make_content(path, kind, value):
    if kind == 'file':
        path.write_text(value, encoding='utf-8')
    else:
        path.mkdir()
        (path / 'empty').mkdir()
        (path / 'slot.dat').write_text(value, encoding='utf-8')
        (path / 'sub').mkdir()
        (path / 'sub' / 'settings.ini').write_text(value + '-settings', encoding='utf-8')


def initialize(root, kind, present):
    root.mkdir(parents=True)
    workspace = root / 'workspace'
    workspace.mkdir()
    target = root / 'target'
    if present:
        make_content(target, kind, 'original-save')
        if kind == 'file':
            shutil.copy2(target, root / 'protection')
        else:
            shutil.copytree(target, root / 'protection')
    make_content(workspace / 'prepared', kind, 'selected-backup')
    manifest = {
        'formatVersion': 1,
        'recoveryId': root.name,
        'kind': kind,
        'before': digest(target),
        'after': digest(workspace / 'prepared')
    }
    write_durable(workspace / 'manifest.json', manifest)
    write_durable(workspace / 'progress.json', {'phase': 'ready'})
    with connect(root) as connection:
        connection.execute('CREATE TABLE recovery (id TEXT PRIMARY KEY, manifest_hash TEXT NOT NULL, resolution TEXT)')
        connection.execute('INSERT INTO recovery VALUES (?, ?, NULL)', (
            root.name, hashlib.sha256((workspace / 'manifest.json').read_bytes()).hexdigest()
        ))
    return manifest


def inspect(root):
    workspace = root / 'workspace'
    with connect(root) as connection:
        row = connection.execute('SELECT manifest_hash, resolution FROM recovery').fetchone()
    observed = {key: digest(root / 'target' if key == 'target' else workspace / key)
                for key in ['target', 'original', 'prepared', 'displaced']}
    result = {'resolution': row[1], 'observed': observed, 'continue': False, 'rollback': False, 'keepCurrent': row[1] is None}
    raw = (workspace / 'manifest.json').read_bytes()
    if row[1] is not None or hashlib.sha256(raw).hexdigest() != row[0]:
        return result
    manifest = json.loads(raw)
    old, new = manifest['before'], manifest['after']
    target, original, prepared, displaced = [observed[key] for key in ['target', 'original', 'prepared', 'displaced']]
    if original not in (None, old) or prepared not in (None, new) or displaced not in (None, new):
        return result
    if prepared is not None and displaced is not None:
        return result
    new_copy = prepared == new or displaced == new
    if old is not None:
        if target == old and original is None:
            result.update({'continue': new_copy, 'rollback': True})
        elif target is None and original == old and new_copy:
            result.update({'continue': True, 'rollback': True})
        elif target == new and original == old and not new_copy:
            result.update({'continue': True, 'rollback': True})
    elif original is None:
        if target is None:
            result.update({'continue': new_copy, 'rollback': True})
        elif target == new and not new_copy:
            result.update({'continue': True, 'rollback': True})
    return result


def resolve(root, action, crash=''):
    state = inspect(root)
    if not state[action]:
        raise ValueError('Action is not allowed by observed content')
    workspace, target = root / 'workspace', root / 'target'
    manifest = json.loads((workspace / 'manifest.json').read_text()) if action != 'keepCurrent' else None
    original = workspace / 'original'
    if action == 'continue':
        if manifest['before'] is not None and digest(target) == manifest['before']:
            move_absent(root, target, original)
            checkpoint(crash, 'old_moved_before_progress')
            write_durable(workspace / 'progress.json', {'phase': 'originalPreserved'})
        if not target.exists():
            prepared = workspace / 'prepared'
            move_absent(root, prepared if prepared.exists() else workspace / 'displaced', target)
            checkpoint(crash, 'new_placed_before_progress')
            write_durable(workspace / 'progress.json', {'phase': 'replacementPlaced'})
        assert digest(target) == manifest['after']
        resolution = 'restored'
    elif action == 'rollback':
        write_durable(workspace / 'progress.json', {'phase': 'rollbackStarted'})
        if digest(target) == manifest['after']:
            move_absent(root, target, workspace / 'displaced')
            checkpoint(crash, 'rollback_new_moved')
        if manifest['before'] is not None and not target.exists():
            move_absent(root, original, target)
            checkpoint(crash, 'rollback_original_restored')
        assert digest(target) == manifest['before']
        resolution = 'rolledBack'
    else:
        resolution = 'keptCurrent'
    connection = connect(root)
    connection.execute('UPDATE recovery SET resolution=?', (resolution,))
    checkpoint(crash, 'before_db_commit')
    connection.commit()
    checkpoint(crash, 'after_db_commit')
    connection.close()


def child(root, action, crash):
    if crash == 'ready':
        checkpoint(crash, 'ready')
    resolve(root, action, crash)


def run_child(root, action, crash):
    process = subprocess.run(
        [sys.executable, str(Path(__file__).resolve()), 'child', str(root), action, crash],
        capture_output=True, text=True, timeout=15, creationflags=0x08000000
    )
    assert process.returncode == CRASH_EXIT, (process.returncode, process.stderr)


def run(base, output):
    if os.name != 'nt':
        raise RuntimeError('This probe validates Windows primitives only')
    run_root = base.resolve() / ('recovery-' + uuid.uuid4().hex)
    run_root.mkdir(parents=True)
    checks = []
    for kind in ['file', 'directory']:
        for present in [False, True]:
            stages = ['ready', 'new_placed_before_progress', 'before_db_commit', 'after_db_commit']
            if present:
                stages.append('old_moved_before_progress')
            for stage in stages:
                for action in ['continue', 'rollback']:
                    root = run_root / uuid.uuid4().hex
                    manifest = initialize(root, kind, present)
                    run_child(root, 'continue', stage)
                    state = inspect(root)
                    if stage == 'after_db_commit':
                        assert state['resolution'] == 'restored'
                        assert not state['continue'] and not state['rollback']
                        expected = manifest['after']
                    else:
                        assert state[action], (kind, present, stage, action, state)
                        resolve(root, action)
                        expected = manifest['after'] if action == 'continue' else manifest['before']
                    assert digest(root / 'target') == expected
                    assert digest(root / 'protection') == manifest['before']
                    checks.append({'kind': kind, 'beforePresent': present, 'interruption': stage, 'action': action, 'passed': True})
            for stage in ['rollback_new_moved'] + (['rollback_original_restored'] if present else []):
                for action in ['continue', 'rollback']:
                    root = run_root / uuid.uuid4().hex
                    manifest = initialize(root, kind, present)
                    run_child(root, 'continue', 'new_placed_before_progress')
                    run_child(root, 'rollback', stage)
                    assert inspect(root)[action]
                    resolve(root, action)
                    assert digest(root / 'target') == (manifest['after'] if action == 'continue' else manifest['before'])
                    checks.append({'kind': kind, 'beforePresent': present, 'interruption': stage, 'action': action, 'passed': True})
            root = run_root / uuid.uuid4().hex
            initialize(root, kind, present)
            run_child(root, 'continue', 'new_placed_before_progress')
            changed = root / 'target' if kind == 'file' else root / 'target' / 'external.dat'
            changed.write_text('later-user-save', encoding='utf-8')
            state = inspect(root)
            assert not state['continue'] and not state['rollback']
            previous = state['observed']
            resolve(root, 'keepCurrent')
            assert inspect(root)['observed'] == previous
            assert inspect(root)['resolution'] == 'keptCurrent'
            checks.append({'kind': kind, 'beforePresent': present, 'interruption': 'external_change', 'action': 'keepCurrent', 'passed': True})
    for kind in ['file', 'directory']:
        root = run_root / uuid.uuid4().hex
        manifest = initialize(root, kind, True)
        move_absent(root, root / 'workspace' / 'prepared', root / 'missing-prepared')
        assert not inspect(root)['continue'] and inspect(root)['rollback']
        resolve(root, 'rollback')
        assert digest(root / 'target') == manifest['before']
        checks.append({'kind': kind, 'interruption': 'missing_prepared', 'action': 'rollback', 'passed': True})

        root = run_root / uuid.uuid4().hex
        initialize(root, kind, True)
        run_child(root, 'continue', 'new_placed_before_progress')
        move_absent(root, root / 'workspace' / 'original', root / 'missing-original')
        assert not inspect(root)['continue'] and not inspect(root)['rollback']
        previous = inspect(root)['observed']
        resolve(root, 'keepCurrent')
        assert inspect(root)['observed'] == previous
        checks.append({'kind': kind, 'interruption': 'missing_original', 'action': 'keepCurrent', 'passed': True})

        root = run_root / uuid.uuid4().hex
        initialize(root, kind, True)
        (root / 'workspace' / 'manifest.json').write_text('{invalid', encoding='utf-8')
        assert not inspect(root)['continue'] and not inspect(root)['rollback']
        previous = inspect(root)['observed']
        resolve(root, 'keepCurrent')
        assert inspect(root)['observed'] == previous
        checks.append({'kind': kind, 'interruption': 'invalid_manifest', 'action': 'keepCurrent', 'passed': True})

        root = run_root / uuid.uuid4().hex
        initialize(root, kind, True)
        before = [digest(root / 'target'), digest(root / 'workspace' / 'prepared')]
        try:
            move_absent(root, root / 'workspace' / 'prepared', root / 'target')
        except OSError:
            pass
        else:
            raise AssertionError('No-replace move overwrote an existing target')
        assert before == [digest(root / 'target'), digest(root / 'workspace' / 'prepared')]
        checks.append({'kind': kind, 'interruption': 'occupied_destination', 'action': 'native_no_replace', 'passed': True})
    report = {'python': sys.version, 'sqlite': sqlite3.sqlite_version, 'platform': sys.platform,
              'primitive': 'MoveFileExW(MOVEFILE_WRITE_THROUGH), without replacement',
              'caseCount': len(checks), 'checks': checks,
              'excluded': ['power loss', 'other operating systems', 'other file systems', 'archive decoding',
                           'application integration', 'workspace cleanup', 'disk-full and permission faults', 'native module packaging']}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'caseCount': len(checks), 'passed': True, 'result': str(output)}))


if __name__ == '__main__':
    if sys.argv[1] == 'child':
        child(Path(sys.argv[2]), sys.argv[3], sys.argv[4])
    else:
        run(Path(sys.argv[2]), Path(sys.argv[3]))
