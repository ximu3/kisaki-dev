from pathlib import Path
import re,json,subprocess
from probe_paths import ROOT, OUT, WORK
def blocks(name):return re.findall(r'```ts\n(.*?)\n```',(ROOT/name).read_text(encoding='utf-8'),re.S)
def block(name,start):return next(x for x in blocks(name) if x.startswith(start))
parts=[
block('refactor/design/domains/catalog.md','type EntryRef'),
block('refactor/design/domains/reader.md','interface NormalizedPoint'),
block('refactor/design/domains/annotations.md','type PlaybackAnnotationLocation'),
block('refactor/design/domains/anime.md','type FileTrackSelection'),
block('refactor/design/domains/sessions.md','type SavedPlaybackSetting'),
*blocks('refactor/design/domains/annotation-contracts.md'),
block('refactor/design/domains/search.md','type SearchTarget'),
block('refactor/design/ui/navigation.md','type PageRef'),
block('refactor/design/domains/preferences.md','type PreferenceKey'),
block('refactor/design/domains/preferences.md','type ShortcutKey'),
block('refactor/design/domains/appearance.md','type ThemeRef'),
block('refactor/design/domains/library-graph-contracts.md','type GraphPartCreate')]
support='''// Owner values used by the extracted declaration checks.
type WorkType = 'game' | 'anime' | 'comic' | 'novel'
type EntryType = WorkType | 'character' | 'person' | 'organization'
type TextEncoding = string
type AnnotationRef<T extends WorkType = WorkType> = { workType: T; id: string }
interface ReadResourceRef { readonly id: string }
interface PreparedAttachment {
 readonly attachmentId: string
 readonly resource: ReadResourceRef
 dispose(): Promise<void>
}
type GraphEntryRef<T extends EntryType = EntryType> = EntryRef<T> | { key: string }
type PartWorkType<K extends PartType> = K extends 'animeEpisode' | 'animeExtra' ? 'anime' : K extends 'novelVolume' ? 'novel' : 'comic'
type PartialDate = { year?: number; month?: number; day?: number }
interface ExternalIdentity { source: string; sourceId: string }
interface PartCommonFields {
 name?: string | null
 originalName?: string | null
 aliases?: readonly string[]
 description?: string | null
 primaryImageId?: string | null
 externalLinks?: readonly { name: string; url: string }[]
 releaseDate?: PartialDate | null
 externalIdentities?: readonly ExternalIdentity[]
}
interface PartSpecificFields {
 novelVolume: { numberLabel?: string | null; declaredPageCount?: number | null }
 comicVolume: { numberLabel?: string | null; declaredPageCount?: number | null; declaredChapterCount?: number | null }
 comicChapter: { numberLabel?: string | null; declaredPageCount?: number | null }
 animeEpisode: { numberLabel?: string | null; type?: 'regular' | 'special' | null; declaredDurationMs?: number | null }
 animeExtra: { type?: 'opening' | 'ending' | 'promotion' | 'interview' | 'other' | null; declaredDurationMs?: number | null }
}
type PartCreateFields<K extends PartType> = PartCommonFields & PartSpecificFields[K]
'''
tests='''
declare function annotation(input: AnnotationCreate): void
declare function setting(result: PlaybackSettingResult): void
declare function part(input: GraphPartCreate): void
declare function query(input: AnnotationQuery, options: AnnotationListOptions): void
declare function search<T extends SearchCategory>(input: { text: string; category: T }): Promise<SearchResult<T>>
annotation({ workType: 'game', gameId: 'g', target: { imageId: 'i' } })
annotation({ workType: 'anime', animeId: 'a', target: { fileId: 'f', location: { type: 'position', positionSeconds: 0 }, imageId: null } })
annotation({ workType: 'comic', comicId: 'c', target: { fileId: 'f', location: { type: 'position', position: { type: 'anchor', anchor: { type: 'textOffset', encoding: 'utf-8', offset: 0 } } }, quote: 'text', imageId: null } })
setting({ sessionId: 's', animeId: 'a', fileId: 'f', outcome: 'saved', saved: { field: 'subtitleScale', scope: 'work', value: 1.25 } })
setting({ sessionId: 's', animeId: 'a', fileId: 'f', outcome: 'applied', saved: null })
part({ key: 'e', type: 'animeEpisode', work: { key: 'a' }, data: { type: 'regular', numberLabel: '1' } })
part({ key: 'v', type: 'comicVolume', work: { type: 'comic', id: 'c' }, data: { numberLabel: '1' } })
query({ scope: { type: 'file', work: { type: 'novel', id: 'n' }, fileId: 'f' }, search: '', refs: [] }, { offset: 0, limit: 20 })
async function consumer() {
 const result = await search({ text: 'a', category: 'annotations' })
 const target: Extract<SearchTarget, { type: 'annotation' }> | undefined = result.items[0]?.target
 void target
 // @ts-expect-error Annotation search cannot return entry targets.
 const wrong: Extract<SearchTarget, { type: 'entry' }> = result.items[0]!.target
 void wrong
}
// @ts-expect-error A saved-only result needs an actual persisted setting.
setting({ sessionId: 's', animeId: 'a', fileId: 'f', outcome: 'saved', saved: null })
// @ts-expect-error The saved scale cannot use the application last-used scope.
setting({ sessionId: 's', animeId: 'a', fileId: 'f', outcome: 'saved', saved: { field: 'subtitleScale', scope: 'application', value: 1 } })
// @ts-expect-error Muting is a boolean value.
setting({ sessionId: 's', animeId: 'a', fileId: 'f', outcome: 'applied', saved: { field: 'muted', scope: 'application', value: 1 } })
// @ts-expect-error Video track memory is not supported.
setting({ sessionId: 's', animeId: 'a', fileId: 'f', outcome: 'saved', saved: { field: 'videoTrack', scope: 'file', value: { type: 'embedded', index: 0 } } })
// @ts-expect-error Games have no file position target.
annotation({ workType: 'game', gameId: 'g', target: { imageId: 'i', fileId: 'f', location: { type: 'position', positionSeconds: 0 } } })
// @ts-expect-error Game annotations require an image.
annotation({ workType: 'game', gameId: 'g', target: { imageId: null } })
// @ts-expect-error Anime annotations do not carry reading quotes.
annotation({ workType: 'anime', animeId: 'a', target: { fileId: 'f', location: { type: 'position', positionSeconds: 0 }, imageId: null, quote: 'text' } })
// @ts-expect-error A novel creation cannot carry a comic owner ID.
annotation({ workType: 'novel', comicId: 'c', target: { imageId: null } })
// @ts-expect-error An episode belongs to anime.
part({ key: 'e', type: 'animeEpisode', work: { type: 'comic', id: 'c' }, data: { type: 'regular' } })
// @ts-expect-error Extra has no number label.
part({ key: 'x', type: 'animeExtra', work: { key: 'a' }, data: { numberLabel: '1' } })
// @ts-expect-error A volume has no episode classification.
part({ key: 'v', type: 'novelVolume', work: { key: 'n' }, data: { type: 'regular' } })
// @ts-expect-error File annotation scope excludes games.
query({ scope: { type: 'file', work: { type: 'game', id: 'g' }, fileId: 'f' }, search: '' }, { offset: 0, limit: 20 })
// @ts-expect-error Search has no all category.
search({ text: 'a', category: 'all' })
// @ts-expect-error Image candidates are not navigation targets.
const invalidTarget: SearchTarget = { type: 'image', id: 'x' }
void invalidTarget
const preference: SearchTarget = { type: 'preference', key: 'usage.novel.text.font' }
void preference
// @ts-expect-error Settings navigation cannot address arbitrary JSON paths.
const invalidPreference: SearchTarget = { type: 'preference', key: 'network.credentials.password' }
void invalidPreference
// @ts-expect-error Extension icons require resource ownership.
const invalidIcon: SearchIcon = { type: 'extension', path: 'icon.svg' }
void invalidIcon
void consumer
'''
tests=re.sub(r'(// @ts-expect-error[^\n]*\n)',r'\1// prettier-ignore\n',tests)
generated=support+'\n\n'.join(parts)+tests
(OUT/'contracts.ts').write_text(generated,encoding='utf-8')
(OUT/'tsconfig.json').write_text(json.dumps({'compilerOptions':{'target':'ES2022','module':'ESNext','strict':True,'noEmit':True,'exactOptionalPropertyTypes':True,'noUncheckedIndexedAccess':True,'types':[],'lib':['ES2022','DOM']},'files':['contracts.ts']},indent=2),encoding='utf-8')
process=subprocess.run(['pnpm.cmd','exec','tsc','-p',str(OUT/'tsconfig.json')],cwd=ROOT,capture_output=True,text=True,creationflags=subprocess.CREATE_NO_WINDOW)
print(process.stdout+process.stderr)
if process.returncode:raise SystemExit(process.returncode)
result={'extractedBlocks':len(parts),'expectedRejections':tests.count('@ts-expect-error'),'status':'passed','scope':'new setting, annotation, search and graph-part shapes; not the complete W02 API','runtimeValuesValidated':False}
(OUT/'type-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
