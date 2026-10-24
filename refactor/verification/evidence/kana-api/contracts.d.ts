/** Public-value design specimen; this is not a Kana implementation. */
export interface NormalizedPoint {
  readonly x: number
  readonly y: number
}

export interface NormalizedRect extends NormalizedPoint {
  readonly width: number
  readonly height: number
}

export type NormalizedQuad = readonly [
  NormalizedPoint,
  NormalizedPoint,
  NormalizedPoint,
  NormalizedPoint
]

export type TextEncoding =
  | 'utf-8'
  | 'ibm866'
  | 'iso-8859-2'
  | 'iso-8859-3'
  | 'iso-8859-4'
  | 'iso-8859-5'
  | 'iso-8859-6'
  | 'iso-8859-7'
  | 'iso-8859-8'
  | 'iso-8859-8-i'
  | 'iso-8859-10'
  | 'iso-8859-13'
  | 'iso-8859-14'
  | 'iso-8859-15'
  | 'iso-8859-16'
  | 'koi8-r'
  | 'koi8-u'
  | 'macintosh'
  | 'windows-874'
  | 'windows-1250'
  | 'windows-1251'
  | 'windows-1252'
  | 'windows-1253'
  | 'windows-1254'
  | 'windows-1255'
  | 'windows-1256'
  | 'windows-1257'
  | 'windows-1258'
  | 'x-mac-cyrillic'
  | 'gbk'
  | 'gb18030'
  | 'big5'
  | 'euc-jp'
  | 'iso-2022-jp'
  | 'shift_jis'
  | 'euc-kr'
  | 'utf-16be'
  | 'utf-16le'
  | 'x-user-defined'

export type ReadingAnchor =
  | { readonly type: 'epubCfi'; readonly value: string }
  | { readonly type: 'textOffset'; readonly encoding: TextEncoding; readonly offset: number }
  | { readonly type: 'xmlNode'; readonly nodePath: readonly number[]; readonly textOffset?: number }
  | { readonly type: 'mobi'; readonly byteOffset: number; readonly textOffset?: number }
  | {
      readonly type: 'kf8'
      readonly documentIndex: number
      readonly byteOffset: number
      readonly textOffset?: number
    }

export type PageRef =
  | { readonly type: 'pageIndex'; readonly index: number }
  | { readonly type: 'memberPath'; readonly path: string }
  | { readonly type: 'epubSpineItem'; readonly index: number }
  | { readonly type: 'kf8Document'; readonly index: number }

export type ReadingLocation =
  | { readonly type: 'anchor'; readonly anchor: ReadingAnchor }
  | { readonly type: 'page'; readonly page: PageRef; readonly point: NormalizedPoint }

type AnchorRange = {
  [T in ReadingAnchor['type']]: {
    readonly type: 'anchors'
    readonly start: Extract<ReadingAnchor, { readonly type: T }>
    readonly end: Extract<ReadingAnchor, { readonly type: T }>
  }
}[ReadingAnchor['type']]

export interface PageTextRange {
  readonly page: PageRef
  readonly quads: readonly [NormalizedQuad, ...NormalizedQuad[]]
}

export type TextRange =
  | AnchorRange
  | { readonly type: 'pages'; readonly pages: readonly [PageTextRange, ...PageTextRange[]] }

export interface PageRegion {
  readonly page: PageRef
  readonly rect: NormalizedRect
}

export interface ViewportRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export type ViewReadTarget =
  { readonly type: 'viewport' } | { readonly type: 'region'; readonly region: PageRegion }

export type ViewRead =
  | {
      readonly type: 'viewport'
      readonly rect: ViewportRect
      readonly location: ReadingLocation
      readonly layout: 'fixed' | 'reflowable'
    }
  | { readonly type: 'region'; readonly rect: ViewportRect; readonly region: PageRegion }

export type ReadingSelection =
  | { readonly type: 'text'; readonly range: TextRange; readonly text: string }
  | { readonly type: 'region'; readonly region: PageRegion }

export type MarkLocation =
  | { readonly type: 'position'; readonly position: ReadingLocation }
  | { readonly type: 'text'; readonly range: TextRange }
  | { readonly type: 'region'; readonly region: PageRegion }

export interface ReadingMark {
  readonly id: string
  readonly location: MarkLocation
  readonly quote?: string
}

export interface MarkProjection {
  readonly marks: readonly ReadingMark[]
  readonly selectedId: string | null
  readonly style: { readonly color: string; readonly opacity: number }
}

export type LocationFailureReason =
  'missingTarget' | 'outOfBounds' | 'ambiguousTarget' | 'notRenderable' | 'encodingMismatch'

export interface MarkOrder {
  readonly groups: readonly (readonly [string, ...string[]])[]
  readonly unresolved: readonly {
    readonly id: string
    readonly reason: LocationFailureReason
  }[]
}

export type ReadingFont =
  | { readonly type: 'document' }
  | { readonly type: 'system'; readonly family: string }
  | { readonly type: 'resource'; readonly id: string }

export interface ReadingSettings {
  readonly flow: 'paginated' | 'continuous'
  readonly pages: {
    readonly arrangement: 'single' | 'spread'
    readonly progression: 'document' | 'ltr' | 'rtl'
    readonly firstPage: 'single' | 'paired'
    readonly fit: 'page' | 'width' | 'height'
    readonly autoCrop: boolean
    readonly brightness: number
    readonly contrast: number
  }
  readonly text: {
    readonly pagesPerView: 1 | 2
    readonly writingMode: 'document' | 'horizontal-tb' | 'vertical-rl' | 'vertical-lr'
    readonly font: ReadingFont
    readonly fontSize: number
    readonly lineHeight: number
    readonly paragraphSpacing: 'document' | number
    readonly alignment: 'document' | 'start' | 'justify'
    readonly padding: number
    readonly maxLineLength: number
  }
  readonly colors:
    | { readonly type: 'document'; readonly background: string }
    | {
        readonly type: 'custom'
        readonly foreground: string
        readonly background: string
      }
}

export type Zoom =
  | { readonly type: 'fit'; readonly mode: 'page' | 'width' | 'height' }
  | { readonly type: 'scale'; readonly value: number }

export type ReadingView =
  | {
      readonly type: 'fixed'
      readonly forwardDirection: 'left' | 'right' | 'down'
      readonly pageSlots: 1 | 2
      readonly zoom: Zoom
      readonly scale: number
      readonly rotation: 0 | 90 | 180 | 270
    }
  | {
      readonly type: 'reflowable'
      readonly forwardDirection: 'left' | 'right' | 'down'
      readonly pageSlots: 1 | 2 | null
      readonly writingMode: 'horizontal-tb' | 'vertical-rl' | 'vertical-lr'
    }

export type ReadingFailure =
  | { readonly code: 'locationUnavailable'; readonly reason: LocationFailureReason }
  | { readonly code: 'layoutUnavailable'; readonly reason: 'insufficientSpace' }
  | {
      readonly code: 'resourceLimit'
      readonly resource: 'source' | 'decoder' | 'member' | 'cache' | 'temporaryStorage' | 'page'
    }
  | {
      readonly code:
        | 'invalidInput'
        | 'unsupportedFormat'
        | 'unsupportedFeature'
        | 'sourceUnavailable'
        | 'sourceChanged'
        | 'readFailed'
        | 'invalidDocument'
        | 'passwordRequired'
        | 'incorrectPassword'
        | 'missingResource'
        | 'assetUnavailable'
        | 'viewChanged'
        | 'targetNotVisible'
        | 'unsupportedTransform'
        | 'cancelled'
        | 'superseded'
        | 'closed'
        | 'internal'
    }

export declare class ReadingError extends Error {
  readonly failure: ReadingFailure
  constructor(failure: ReadingFailure, options?: ErrorOptions)
}

export interface ReadingState {
  readonly phase: 'ready' | 'closing' | 'closed'
  readonly activity: 'idle' | 'navigating' | 'layingOut'
  readonly location: ReadingLocation
  readonly view: ReadingView
  readonly progress: { readonly fraction: number; readonly estimated: boolean } | null
  readonly canGoPrevious: boolean
  readonly canGoNext: boolean
  readonly canGoBack: boolean
  readonly canGoForward: boolean
  readonly referenceView: { readonly target: ReadingLocation } | null
  readonly selection: 'none' | 'text' | 'region'
  readonly interactionMode: InteractionMode
  readonly capabilities: {
    readonly search: boolean
    readonly textSelection: boolean
    readonly pageRegion: boolean
  }
  readonly notices: readonly ReadingNotice[]
  readonly failure: ReadingFailure | null
}

export type InteractionMode = 'read' | 'region' | 'pan'

export interface ReadingKeyInput {
  readonly key: string
  readonly code: string
  readonly altKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
  readonly repeat: boolean
}

export type ReadingNotice =
  | { readonly type: 'fontUnavailable'; readonly id: string }
  | { readonly type: 'resourceOmitted'; readonly resource: 'image' | 'font' | 'style' }

export interface SearchHit {
  readonly range: TextRange
  readonly excerpt: string
}

export declare function getStartLocation(location: MarkLocation): ReadingLocation
export declare function getDefaultSettings(): ReadingSettings
export declare function parseReadingLocation(value: unknown): ReadingLocation | null
export declare function parseTextRange(value: unknown): TextRange | null
export declare function parsePageRegion(value: unknown): PageRegion | null
export declare function parseReadingSettings(value: unknown): ReadingSettings | null
