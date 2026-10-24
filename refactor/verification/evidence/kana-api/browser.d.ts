/** Browser-entry design specimen; public values have one definition in contracts. */
import type {
  InteractionMode,
  MarkOrder,
  MarkProjection,
  ReadingFailure,
  ReadingKeyInput,
  ReadingLocation,
  ReadingSelection,
  ReadingSettings,
  ReadingState,
  SearchHit,
  TextEncoding,
  ViewRead,
  ViewReadTarget,
  Zoom
} from './contracts.js'

export interface CallOptions {
  readonly signal?: AbortSignal
}

export interface ByteSource {
  readonly size: number
  read(offset: number, length: number, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>>
}

export interface MemberSource {
  list(signal: AbortSignal): AsyncIterable<{ readonly path: string }>
  open(path: string, signal: AbortSignal): Promise<OpenedMember | null>
}

export interface OpenedMember {
  readonly data: ByteSource
  dispose(): Promise<void>
}

export type ReadingSource =
  | {
      readonly type: 'document'
      readonly data: ByteSource
      readonly name?: string
    }
  | { readonly type: 'directory'; readonly members: MemberSource }

export interface TemporaryFile {
  read(offset: number, length: number, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>>
  write(offset: number, data: Uint8Array<ArrayBuffer>, signal: AbortSignal): Promise<void>
  dispose(): Promise<void>
}

export interface TemporaryStorage {
  create(signal: AbortSignal): Promise<TemporaryFile>
}

export interface FontResource {
  readonly id: string
  readonly faces: readonly {
    readonly data: ByteSource | Blob
    readonly weight: number | readonly [number, number]
    readonly style: 'normal' | 'italic' | 'oblique'
  }[]
}

export interface SetSettingsOptions extends CallOptions {
  readonly fonts?: readonly FontResource[]
}

export interface OpenReaderOptions extends CallOptions {
  readonly container: HTMLElement
  readonly source: ReadingSource | Blob
  readonly settings: ReadingSettings
  readonly position?: ReadingLocation | 'start'
  readonly textEncoding?: TextEncoding
  readonly password?: string
  readonly fonts?: readonly FontResource[]
  readonly temporaryStorage?: TemporaryStorage
  readonly assetsBaseUrl: string | URL
  readonly handleKeyDown?: (input: ReadingKeyInput) => boolean
}

export interface NavigationItem {
  readonly label: string
  readonly children: readonly NavigationItem[]
  readonly getLocation: ((options?: CallOptions) => Promise<ReadingLocation>) | null
}

export interface ReaderEvents {
  readonly selectionChange: undefined
  readonly externalLink: { readonly url: string }
  readonly markActivate: { readonly id: string }
  readonly error: { readonly failure: ReadingFailure; readonly fatal: boolean }
}

export interface Reader {
  getState(): ReadingState
  observe(listener: (state: ReadingState) => void): () => void
  on<K extends keyof ReaderEvents>(event: K, listener: (event: ReaderEvents[K]) => void): () => void
  getNavigation(options?: CallOptions): Promise<readonly NavigationItem[]>
  seek(position: ReadingLocation | 'start', options?: CallOptions): Promise<ReadingLocation>
  next(options?: CallOptions): Promise<ReadingLocation>
  previous(options?: CallOptions): Promise<ReadingLocation>
  back(options?: CallOptions): Promise<ReadingLocation>
  forward(options?: CallOptions): Promise<ReadingLocation>
  closeReference(): Promise<void>
  setSettings(settings: ReadingSettings, options?: SetSettingsOptions): Promise<void>
  setZoom(zoom: Zoom, options?: CallOptions): Promise<void>
  setRotation(rotation: 0 | 90 | 180 | 270, options?: CallOptions): Promise<void>
  setInteractionMode(mode: InteractionMode): void
  clearSelection(): void
  getSelection(options?: CallOptions): Promise<ReadingSelection | null>
  getTextContext(position: ReadingLocation, options?: CallOptions): Promise<string | null>
  search(
    query: string,
    options?: CallOptions & { readonly caseSensitive?: boolean; readonly wholeWord?: boolean }
  ): AsyncIterableIterator<SearchHit>
  setMarks(projection: MarkProjection, options?: CallOptions): Promise<MarkOrder>
  readView<Target extends ViewReadTarget, Result>(
    target: Target,
    read: (
      view: Extract<ViewRead, { readonly type: NoInfer<Target>['type'] }>,
      signal: AbortSignal
    ) => Promise<Result>,
    options?: CallOptions
  ): Promise<Result>
  close(): Promise<void>
}

export declare function openReader(options: OpenReaderOptions): Promise<Reader>

export interface UrlSource {
  readonly source: ReadingSource
  dispose(): Promise<void>
}

export declare function openUrlSource(
  url: string | URL,
  options?: CallOptions & {
    readonly headers?: Readonly<Record<string, string>>
    readonly credentials?: RequestCredentials
    readonly temporaryStorage?: TemporaryStorage
  }
): Promise<UrlSource>

export declare function createBrowserTemporaryStorage(): TemporaryStorage
