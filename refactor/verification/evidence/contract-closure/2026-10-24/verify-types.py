"""Check the current file-switch result shape; no application code is executed."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=Path, required=True)
parser.add_argument('--node', type=Path, required=True)
parser.add_argument('--tsc', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=False)

def block(relative, prefix):
    source = (args.root / relative).read_text(encoding='utf-8-sig')
    return next(value for value in re.findall(r'```ts\n(.*?)\n```', source, re.S) if value.startswith(prefix))

sources = [
    ('refactor/design/communication.md', 'interface ErrorSummary'),
    ('refactor/design/domains/sessions.md', 'type FileSession'),
]
support = '''// Representative owner shapes, not complete Session declarations.
interface AnimeSession { type: 'anime'; sessionId: string; animeId: string; fileId: string }
interface ComicSession { type: 'comic'; sessionId: string; comicId: string; fileId: string }
interface NovelSession { type: 'novel'; sessionId: string; novelId: string; fileId: string }
interface GameSession { type: 'game'; sessionId: string; gameId: string; launchConfigId: string }
'''
consumer = '''
declare const anime: AnimeSession
declare const comic: ComicSession
declare const novel: NovelSession
declare function acceptAnime(value: FileSwitchResult<AnimeSession>): void
declare function acceptComic(value: FileSwitchResult<ComicSession>): void
declare function acceptNovel(value: FileSwitchResult<NovelSession>): void
acceptAnime({ outcome: 'ready', session: anime })
acceptComic({ outcome: 'ready', session: comic })
acceptNovel({ outcome: 'ready', session: novel })
const ended: FileSwitchResult<AnimeSession> = {
  outcome: 'previousEnded', previousSessionId: 'old', targetFileId: 'target'
}
const failure: ExecutionFailure<FileSwitchResult<AnimeSession>> = {
  code: 'ReadFailed', message: 'The target could not be opened.', partialResult: ended
}
function inspect(result: FileSwitchResult<AnimeSession>) {
  if (result.outcome === 'ready') {
    const ready: AnimeSession = result.session
    return ready.sessionId
  }
  const original: string = result.previousSessionId
  const target: string = result.targetFileId
  return original + target
}
// @ts-expect-error A ready result requires a complete owner Session shape.
acceptAnime({ outcome: 'ready' })
// @ts-expect-error Comic sessions cannot complete an anime switch.
acceptAnime({ outcome: 'ready', session: comic })
// @ts-expect-error Games do not participate in file switching.
type InvalidGameSwitch = FileSwitchResult<GameSession>
// @ts-expect-error The ended branch identifies the original session.
acceptAnime({ outcome: 'previousEnded', targetFileId: 'target' })
// @ts-expect-error The ended branch preserves the admitted file target.
acceptAnime({ outcome: 'previousEnded', previousSessionId: 'old' })
// @ts-expect-error The ended branch is not an unfinished Session.
acceptAnime({ outcome: 'previousEnded', previousSessionId: 'old', targetFileId: 'target', session: anime })
// @ts-expect-error Partial results must still be complete business results.
const incomplete: ExecutionFailure<FileSwitchResult<AnimeSession>> = { code: 'ReadFailed', message: 'Failed.', partialResult: { previousSessionId: 'old' } }
// @ts-expect-error A previous-ended result has no new Session to consume.
const missingSession = ended.session
void failure; void inspect; void incomplete; void missingSession
'''
generated = support + '\n\n'.join(block(name, prefix) for name, prefix in sources) + consumer
(args.out / 'contract-types.ts').write_text(generated, encoding='utf-8')
config = {'compilerOptions': {'target': 'ES2022', 'module': 'ESNext', 'strict': True, 'exactOptionalPropertyTypes': True, 'noUncheckedIndexedAccess': True, 'noEmit': True, 'types': [], 'lib': ['ES2022']}, 'files': ['contract-types.ts']}
(args.out / 'tsconfig.json').write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
def run(arguments):
    return subprocess.run(arguments, capture_output=True, text=True, encoding='utf-8', creationflags=flags)
check = run([str(args.node), str(args.tsc), '-p', str(args.out / 'tsconfig.json')])
if check.returncode:
    print(check.stdout + check.stderr)
    raise SystemExit(check.returncode)
result = {
    'checkedOn': '2026-10-24',
    'node': run([str(args.node), '--version']).stdout.strip(),
    'typescript': run([str(args.node), str(args.tsc), '--version']).stdout.strip(),
    'scope': 'Extracted file-switch result and ExecutionFailure shapes with representative owner types; not runtime, complete Session declarations or public package verification.',
    'expectedRejections': consumer.count('@ts-expect-error'),
    'sources': [{'path': name, 'sha256': hashlib.sha256((args.root / name).read_bytes()).hexdigest()} for name, _ in sources],
    'status': 'passed',
    'formalHostExecuted': False,
}
(args.out / 'type-results.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result))
