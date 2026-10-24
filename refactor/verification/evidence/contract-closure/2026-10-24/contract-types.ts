// Representative owner shapes, not complete Session declarations.
interface AnimeSession { type: 'anime'; sessionId: string; animeId: string; fileId: string }
interface ComicSession { type: 'comic'; sessionId: string; comicId: string; fileId: string }
interface NovelSession { type: 'novel'; sessionId: string; novelId: string; fileId: string }
interface GameSession { type: 'game'; sessionId: string; gameId: string; launchConfigId: string }
interface ErrorSummary {
  code: string
  message: string
}

interface ExecutionFailure<Result> extends ErrorSummary {
  partialResult?: Result
}

type FileSession = AnimeSession | ComicSession | NovelSession

type FileSwitchResult<S extends FileSession = FileSession> =
  | {
      outcome: 'ready'
      session: S
    }
  | {
      outcome: 'previousEnded'
      previousSessionId: string
      targetFileId: string
    }
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
