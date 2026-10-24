// Owner values used by the extracted declaration checks.
type WorkType = 'game' | 'anime' | 'comic' | 'novel'
type EntryType = WorkType | 'character' | 'person' | 'organization'
type TextEncoding = string
type AnnotationRef<T extends WorkType = WorkType> = { workType: T; id: string }
interface ReadResourceRef {
  readonly id: string
}
interface PreparedAttachment {
  readonly attachmentId: string
  readonly resource: ReadResourceRef
  dispose(): Promise<void>
}
type GraphEntryRef<T extends EntryType = EntryType> = EntryRef<T> | { key: string }
type PartWorkType<K extends PartType> = K extends 'animeEpisode' | 'animeExtra'
  ? 'anime'
  : K extends 'novelVolume'
    ? 'novel'
    : 'comic'
type PartialDate = { year?: number; month?: number; day?: number }
interface ExternalIdentity {
  source: string
  sourceId: string
}
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
  comicVolume: {
    numberLabel?: string | null
    declaredPageCount?: number | null
    declaredChapterCount?: number | null
  }
  comicChapter: { numberLabel?: string | null; declaredPageCount?: number | null }
  animeEpisode: {
    numberLabel?: string | null
    type?: 'regular' | 'special' | null
    declaredDurationMs?: number | null
  }
  animeExtra: {
    type?: 'opening' | 'ending' | 'promotion' | 'interview' | 'other' | null
    declaredDurationMs?: number | null
  }
}
type PartCreateFields<K extends PartType> = PartCommonFields & PartSpecificFields[K]
type EntryRef<T extends EntryType = EntryType> = {
  type: T
  id: string
}

type WorkRef = EntryRef<WorkType>

type PartType = 'novelVolume' | 'comicVolume' | 'comicChapter' | 'animeEpisode' | 'animeExtra'

type PartRef<T extends PartType = PartType> = {
  type: T
  id: string
}

interface NormalizedPoint {
  x: number
  y: number
}

interface NormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

type NormalizedQuad = readonly [NormalizedPoint, NormalizedPoint, NormalizedPoint, NormalizedPoint]

type ReadingAnchor =
  | { type: 'epubCfi'; value: string }
  | { type: 'textOffset'; encoding: TextEncoding; offset: number }
  | { type: 'xmlNode'; nodePath: readonly number[]; textOffset?: number }
  | { type: 'mobi'; byteOffset: number; textOffset?: number }
  | {
      type: 'kf8'
      documentIndex: number
      byteOffset: number
      textOffset?: number
    }

type ReadingPageRef =
  | { type: 'pageIndex'; index: number }
  | { type: 'memberPath'; path: string }
  | { type: 'epubSpineItem'; index: number }
  | { type: 'kf8Document'; index: number }

type ReadingPosition =
  | { type: 'anchor'; anchor: ReadingAnchor }
  | { type: 'page'; page: ReadingPageRef; point: NormalizedPoint }

type ReadingTextSelection =
  | { type: 'anchors'; start: ReadingAnchor; end: ReadingAnchor }
  | {
      type: 'pages'
      pages: readonly {
        page: ReadingPageRef
        quads: readonly NormalizedQuad[]
      }[]
    }

interface ReadingPageRegion {
  page: ReadingPageRef
  rect: NormalizedRect
}

type ReadingAnnotationLocation =
  | { type: 'position'; position: ReadingPosition }
  | { type: 'text'; selection: ReadingTextSelection }
  | { type: 'region'; region: ReadingPageRegion }

type PlaybackAnnotationLocation =
  | { type: 'position'; positionSeconds: number }
  | { type: 'range'; startSeconds: number; endSeconds: number }

type FileTrackSelection =
  { type: 'embedded'; index: number } | { type: 'external'; path: string; index: number }

type SavedPlaybackSetting =
  | { field: 'volumePercent'; scope: 'application'; value: number }
  | { field: 'muted'; scope: 'application'; value: boolean }
  | {
      field: 'audioDelaySeconds' | 'subtitleDelaySeconds'
      scope: 'file'
      value: number
    }
  | { field: 'subtitleScale'; scope: 'global' | 'work' | 'file'; value: number }
  | {
      field: 'audioTrack' | 'subtitleTrack'
      scope: 'file'
      value: FileTrackSelection
    }

type PlaybackSettingResult = {
  sessionId: string
  animeId: string
  fileId: string
} & (
  | { outcome: 'applied'; saved: null }
  | { outcome: 'applied' | 'saved'; saved: SavedPlaybackSetting }
)

type AnnotationScope =
  | { type: 'library' }
  | { type: 'work'; work: WorkRef }
  | {
      type: 'file'
      work: EntryRef<'anime' | 'comic' | 'novel'>
      fileId: string
    }

interface AnnotationQuery {
  scope: AnnotationScope
  search: string
  workTypes?: readonly WorkType[]
  refs?: readonly AnnotationRef[]
}

interface AnnotationListOptions {
  offset: number
  limit: number
}

interface AnnotationListResult {
  items: readonly AnnotationSummary[]
  total: number
}

type AnnotationPositionHint =
  | { type: 'video'; startSeconds: number; endSeconds: number | null }
  | { type: 'page'; page: ReadingPageRef }

interface AnnotationSummary {
  ref: AnnotationRef
  work: WorkRef
  fileId: string | null
  title: string | null
  quoteExcerpt: string | null
  contentExcerpt: string | null
  imageId: string | null
  locationKind: 'image' | 'position' | 'range' | 'text' | 'region'
  positionHint: AnnotationPositionHint | null
  createdAt: number
  updatedAt: number
}

type AnnotationLocationItem =
  | {
      ref: AnnotationRef<'anime'>
      location: PlaybackAnnotationLocation
      createdAt: number
    }
  | {
      ref: AnnotationRef<'comic' | 'novel'>
      location: ReadingAnnotationLocation
      createdAt: number
    }

interface AnnotationLocationResult {
  items: readonly AnnotationLocationItem[]
  total: number
}

type AnnotationCreate = {
  title?: string | null
  content?: string
  prepared?: readonly PreparedAttachment[]
} & (
  | { workType: 'game'; gameId: string; target: { imageId: string } }
  | {
      workType: 'anime'
      animeId: string
      target: {
        fileId: string
        location: PlaybackAnnotationLocation
        imageId: string | null
      }
    }
  | {
      workType: 'comic'
      comicId: string
      target: {
        fileId: string
        location: ReadingAnnotationLocation
        quote: string | null
        imageId: string | null
      }
    }
  | {
      workType: 'novel'
      novelId: string
      target: {
        fileId: string
        location: ReadingAnnotationLocation
        quote: string | null
        imageId: string | null
      }
    }
)

type SearchTarget =
  | { type: 'entry'; ref: EntryRef }
  | { type: 'part'; work: WorkRef; ref: PartRef }
  | { type: 'collection'; id: string }
  | { type: 'tag'; id: string }
  | { type: 'note'; id: string }
  | { type: 'annotation'; ref: AnnotationRef }
  | { type: 'metadataProfile'; id: string }
  | { type: 'scanConfig'; id: string }
  | { type: 'launchConfig'; gameId: string; id: string }
  | { type: 'theme'; ref: ThemeRef }
  | { type: 'font'; id: string }
  | { type: 'extension'; id: string }
  | { type: 'page'; ref: PageRef }
  | { type: 'preference'; key: PreferenceKey }

type SearchCategory =
  | 'catalog'
  | 'notes'
  | 'annotations'
  | 'configurations'
  | 'themes'
  | 'fonts'
  | 'extensions'
  | 'pages'
  | 'preferences'

interface SearchTargetMap {
  catalog: Extract<SearchTarget, { type: 'entry' | 'part' | 'collection' | 'tag' }>
  notes: Extract<SearchTarget, { type: 'note' }>
  annotations: Extract<SearchTarget, { type: 'annotation' }>
  configurations: Extract<SearchTarget, { type: 'metadataProfile' | 'scanConfig' | 'launchConfig' }>
  themes: Extract<SearchTarget, { type: 'theme' }>
  fonts: Extract<SearchTarget, { type: 'font' }>
  extensions: Extract<SearchTarget, { type: 'extension' }>
  pages: Extract<SearchTarget, { type: 'page' }>
  preferences: Extract<SearchTarget, { type: 'preference' }>
}

interface SearchItem<T extends SearchCategory = SearchCategory> {
  target: SearchTargetMap[T]
  title: string
  context: string | null
  excerpt: string | null
  imageId: string | null
  icon: SearchIcon | null
}

type SearchIcon =
  { type: 'mdi'; name: string } | { type: 'extension'; extensionId: string; path: string }

interface SearchResult<T extends SearchCategory = SearchCategory> {
  items: readonly SearchItem<T>[]
  total: number
}

type PageRef =
  { type: 'native'; id: string } | { type: 'extension'; extensionId: string; pageId: string }

type PreferenceKey =
  | 'general.uiTranslation'
  | 'general.closeMainWindow'
  | 'appearance.theme'
  | 'appearance.mode'
  | 'appearance.interfaceScale'
  | 'navigation.order'
  | 'navigation.visibleLimit'
  | 'library.showNsfw'
  | 'library.autoRefreshHoldings'
  | 'usage.foregroundGracePeriodMs'
  | 'usage.game.showPanelOnStart'
  | 'usage.game.panelAlwaysOnTop'
  | `usage.anime.${
      | 'audioLanguages'
      | 'subtitleLanguages'
      | 'subtitlesEnabled'
      | 'playbackSpeed'
      | 'subtitleScale'
      | 'autoAdvance'
      | 'autoMarkWatched'}`
  | `usage.${'comic' | 'novel'}.${ReadingPreferenceKey}`
  | `shortcuts.${ShortcutKey}`
  | 'network.mode'
  | 'network.endpoint'
  | 'network.bypassRules'
  | 'network.credentials'
  | 'updates.autoCheck'
  | 'updates.allowPrerelease'

type ReadingPreferenceKey =
  | 'flow'
  | 'colors'
  | `pages.${'arrangement' | 'progression' | 'firstPage' | 'fit' | 'autoCrop' | 'brightness' | 'contrast'}`
  | `text.${
      | 'pagesPerView'
      | 'writingMode'
      | 'font'
      | 'fontSize'
      | 'lineHeight'
      | 'paragraphSpacing'
      | 'alignment'
      | 'padding'
      | 'maxLineLength'}`

type ShortcutKey =
  | 'main.search'
  | 'main.preferences'
  | 'editor.save'
  | `reader.${
      | 'find'
      | 'left'
      | 'right'
      | 'up'
      | 'down'
      | 'previous'
      | 'next'
      | 'fullscreen'
      | 'addAnnotation'
      | 'toggleAnnotations'
      | 'toggleTiming'
      | 'viewWork'}`
  | `player.${
      | 'playPause'
      | 'seekBackward'
      | 'seekForward'
      | 'volumeUp'
      | 'volumeDown'
      | 'toggleMute'
      | 'toggleSubtitles'
      | 'fullscreen'
      | 'addAnnotation'
      | 'toggleAnnotations'
      | 'toggleTiming'
      | 'viewWork'}`
  | `game.${'addAnnotation' | 'toggleAnnotations' | 'togglePanel' | 'toggleTiming' | 'viewWork'}`

type ThemeRef =
  | { type: 'builtin'; id: 'default' }
  | { type: 'user'; id: string }
  | { type: 'extension'; extensionId: string; id: string }

type GraphPartCreate = {
  [K in PartType]: {
    key: string
    type: K
    work: GraphEntryRef<PartWorkType<K>>
    data: PartCreateFields<K>
    completed?: boolean
  }
}[PartType]
declare function annotation(input: AnnotationCreate): void
declare function setting(result: PlaybackSettingResult): void
declare function part(input: GraphPartCreate): void
declare function query(input: AnnotationQuery, options: AnnotationListOptions): void
declare function search<T extends SearchCategory>(input: {
  text: string
  category: T
}): Promise<SearchResult<T>>
annotation({ workType: 'game', gameId: 'g', target: { imageId: 'i' } })
annotation({
  workType: 'anime',
  animeId: 'a',
  target: { fileId: 'f', location: { type: 'position', positionSeconds: 0 }, imageId: null }
})
annotation({
  workType: 'comic',
  comicId: 'c',
  target: {
    fileId: 'f',
    location: {
      type: 'position',
      position: { type: 'anchor', anchor: { type: 'textOffset', encoding: 'utf-8', offset: 0 } }
    },
    quote: 'text',
    imageId: null
  }
})
setting({
  sessionId: 's',
  animeId: 'a',
  fileId: 'f',
  outcome: 'saved',
  saved: { field: 'subtitleScale', scope: 'work', value: 1.25 }
})
setting({ sessionId: 's', animeId: 'a', fileId: 'f', outcome: 'applied', saved: null })
part({
  key: 'e',
  type: 'animeEpisode',
  work: { key: 'a' },
  data: { type: 'regular', numberLabel: '1' }
})
part({
  key: 'v',
  type: 'comicVolume',
  work: { type: 'comic', id: 'c' },
  data: { numberLabel: '1' }
})
query(
  { scope: { type: 'file', work: { type: 'novel', id: 'n' }, fileId: 'f' }, search: '', refs: [] },
  { offset: 0, limit: 20 }
)
async function consumer() {
  const result = await search({ text: 'a', category: 'annotations' })
  const target: Extract<SearchTarget, { type: 'annotation' }> | undefined = result.items[0]?.target
  void target
  // @ts-expect-error Annotation search cannot return entry targets.
  // prettier-ignore
  const wrong: Extract<SearchTarget, { type: 'entry' }> = result.items[0]!.target
  void wrong
}
// @ts-expect-error A saved-only result needs an actual persisted setting.
// prettier-ignore
setting({ sessionId: 's', animeId: 'a', fileId: 'f', outcome: 'saved', saved: null })
// @ts-expect-error The saved scale cannot use the application last-used scope.
// prettier-ignore
setting({ sessionId: 's', animeId: 'a', fileId: 'f', outcome: 'saved', saved: { field: 'subtitleScale', scope: 'application', value: 1 } })
// @ts-expect-error Muting is a boolean value.
// prettier-ignore
setting({ sessionId: 's', animeId: 'a', fileId: 'f', outcome: 'applied', saved: { field: 'muted', scope: 'application', value: 1 } })
// @ts-expect-error Video track memory is not supported.
// prettier-ignore
setting({ sessionId: 's', animeId: 'a', fileId: 'f', outcome: 'saved', saved: { field: 'videoTrack', scope: 'file', value: { type: 'embedded', index: 0 } } })
// @ts-expect-error Games have no file position target.
// prettier-ignore
annotation({ workType: 'game', gameId: 'g', target: { imageId: 'i', fileId: 'f', location: { type: 'position', positionSeconds: 0 } } })
// @ts-expect-error Game annotations require an image.
// prettier-ignore
annotation({ workType: 'game', gameId: 'g', target: { imageId: null } })
// @ts-expect-error Anime annotations do not carry reading quotes.
// prettier-ignore
annotation({ workType: 'anime', animeId: 'a', target: { fileId: 'f', location: { type: 'position', positionSeconds: 0 }, imageId: null, quote: 'text' } })
// @ts-expect-error A novel creation cannot carry a comic owner ID.
// prettier-ignore
annotation({ workType: 'novel', comicId: 'c', target: { imageId: null } })
// @ts-expect-error An episode belongs to anime.
// prettier-ignore
part({ key: 'e', type: 'animeEpisode', work: { type: 'comic', id: 'c' }, data: { type: 'regular' } })
// @ts-expect-error Extra has no number label.
// prettier-ignore
part({ key: 'x', type: 'animeExtra', work: { key: 'a' }, data: { numberLabel: '1' } })
// @ts-expect-error A volume has no episode classification.
// prettier-ignore
part({ key: 'v', type: 'novelVolume', work: { key: 'n' }, data: { type: 'regular' } })
// @ts-expect-error File annotation scope excludes games.
// prettier-ignore
query({ scope: { type: 'file', work: { type: 'game', id: 'g' }, fileId: 'f' }, search: '' }, { offset: 0, limit: 20 })
// @ts-expect-error Search has no all category.
// prettier-ignore
search({ text: 'a', category: 'all' })
// @ts-expect-error Image candidates are not navigation targets.
// prettier-ignore
const invalidTarget: SearchTarget = { type: 'image', id: 'x' }
void invalidTarget
const preference: SearchTarget = { type: 'preference', key: 'usage.novel.text.font' }
void preference
// @ts-expect-error Settings navigation cannot address arbitrary JSON paths.
// prettier-ignore
const invalidPreference: SearchTarget = { type: 'preference', key: 'network.credentials.password' }
void invalidPreference
// @ts-expect-error Extension icons require resource ownership.
// prettier-ignore
const invalidIcon: SearchIcon = { type: 'extension', path: 'icon.svg' }
void invalidIcon
void consumer
