/** Compile with ECMAScript types only; no DOM or Node ambient declarations. */
import {
  ReadingError,
  getDefaultSettings,
  getStartLocation,
  parseReadingLocation,
  type MarkOrder,
  type ReadingKeyInput,
  type ReadingLocation,
  type ReadingSettings,
  type ReadingState,
  type ReadingView,
  type TextRange
} from '@ximu3/kana/contracts'

declare const stored: unknown
declare const settings: ReadingSettings
declare const state: ReadingState
declare const marks: MarkOrder
declare const keyInput: ReadingKeyInput

const plainKey: readonly [string, string, boolean] = [keyInput.key, keyInput.code, keyInput.repeat]
void plainKey

const restored: ReadingLocation | null = parseReadingLocation(stored)
const selected: TextRange = {
  type: 'anchors',
  start: { type: 'kf8', documentIndex: 0, byteOffset: 10, textOffset: 1 },
  end: { type: 'kf8', documentIndex: 1, byteOffset: 20, textOffset: 2 }
}
const target = getStartLocation({ type: 'text', range: selected })
const defaults: ReadingSettings = getDefaultSettings()
const displayOrganization: readonly ['paginated' | 'continuous', 'single' | 'spread', 1 | 2] = [
  defaults.flow,
  defaults.pages.arrangement,
  defaults.text.pagesPerView
]
const independentPresentation: ReadingSettings = {
  ...defaults,
  flow: 'paginated',
  pages: { ...defaults.pages, arrangement: 'single', progression: 'document' },
  text: {
    ...defaults.text,
    pagesPerView: 2,
    writingMode: 'vertical-rl',
    paragraphSpacing: 'document',
    alignment: 'document'
  }
}
const documentColors: ReadingSettings = {
  ...defaults,
  colors: { type: 'document', background: '#171717' }
}
const resolvedColors: ReadingSettings = {
  ...defaults,
  colors: { type: 'custom', foreground: '#eeeeee', background: '#171717' }
}
if (settings.colors.type === 'custom') {
  const palette: readonly [string, string] = [
    settings.colors.foreground,
    settings.colors.background
  ]
  void palette
} else {
  const surround: string = settings.colors.background
  void surround
}
const failure = new ReadingError({ code: 'locationUnavailable', reason: 'missingTarget' })
const layoutFailure = new ReadingError({ code: 'layoutUnavailable', reason: 'insufficientSpace' })
const fixedView: ReadingView = {
  type: 'fixed',
  forwardDirection: 'left',
  pageSlots: 2,
  zoom: { type: 'fit', mode: 'page' },
  scale: 0.8,
  rotation: 0
}
const continuousView: ReadingView = {
  type: 'reflowable',
  forwardDirection: 'down',
  pageSlots: null,
  writingMode: 'horizontal-tb'
}
const layoutFeedback: readonly ['left' | 'right' | 'down', 1 | 2 | null] = [
  state.view.forwardDirection,
  state.view.pageSlots
]
if (state.view.type === 'fixed') {
  const fixedSlots: 1 | 2 = state.view.pageSlots
  void fixedSlots
}
const equalStartIds: readonly string[] | undefined = marks.groups[0]
const historyAvailability: readonly [boolean, boolean] = [state.canGoBack, state.canGoForward]
if (state.referenceView) {
  const referenceTarget: ReadingLocation = state.referenceView.target
  // @ts-expect-error A reference-view descriptor is not a persistent source location.
  const descriptorAsLocation: ReadingLocation = state.referenceView
  void [referenceTarget, descriptorAsLocation]
}
if (state.progress) {
  const estimated: boolean = state.progress.estimated
  void estimated
}

const automatic: ReadingLocation = {
  type: 'anchor',
  // @ts-expect-error A persisted TXT location names its actual decoding condition.
  anchor: { type: 'textOffset', encoding: 'auto', offset: 0 }
}
// @ts-expect-error One continuous source range cannot mix addressing systems.
const mixed: TextRange = {
  type: 'anchors',
  start: { type: 'mobi', byteOffset: 4 },
  end: { type: 'epubCfi', value: 'epubcfi(/6/2!/4)' }
}
// @ts-expect-error Page-based selections contain at least one selected page.
const emptyPages: TextRange = { type: 'pages', pages: [] }
const emptyQuads: TextRange = {
  type: 'pages',
  // @ts-expect-error A selected page contains at least one quad.
  pages: [{ page: { type: 'pageIndex', index: 0 }, quads: [] }]
}
// @ts-expect-error A pure source address cannot hold a browser Range.
const domRange: Range | null = null
// @ts-expect-error Importing contracts must not pull in HTMLElement definitions.
const element: HTMLElement | null = null
// @ts-expect-error Location failures require their own reason.
const missingReason = new ReadingError({ code: 'locationUnavailable' })
// @ts-expect-error A closed instance is not a source-location failure.
const wrongReason = new ReadingError({ code: 'closed', reason: 'missingTarget' })
// @ts-expect-error Previously delivered state remains immutable.
state.location = target
// @ts-expect-error Engine colors describe document or resolved colors, not an application theme.
const unresolvedColors: ReadingSettings['colors'] = { type: 'theme' }
// @ts-expect-error Document colors still require the resolved surrounding background.
const documentWithoutBackground: ReadingSettings['colors'] = { type: 'document' }
const documentWithForeground: ReadingSettings['colors'] = {
  type: 'document',
  background: '#111111',
  // @ts-expect-error A document color choice does not override the document foreground.
  foreground: '#eeeeee'
}
// @ts-expect-error Custom reading colors require a complete foreground and background pair.
const customWithoutForeground: ReadingSettings['colors'] = { type: 'custom', background: '#111111' }
// @ts-expect-error Custom reading colors cannot omit the background.
const customWithoutBackground: ReadingSettings['colors'] = { type: 'custom', foreground: '#eeeeee' }
// @ts-expect-error Color intent is explicit; the former undiscriminated pair is not accepted.
const undiscriminatedColors: ReadingSettings['colors'] = {
  foreground: '#eeeeee',
  background: '#111111'
}
// @ts-expect-error Only the custom branch supplies a foreground override.
const unclassifiedForeground: string = settings.colors.foreground
// @ts-expect-error A host font-library identity must be resolved into a provided font resource.
const unresolvedFont: ReadingSettings['text']['font'] = { type: 'user', id: 'host-font' }
// @ts-expect-error The retired reading-mode key is not a second input spelling.
const oldMode = settings.readingMode
// @ts-expect-error Source-page arrangement and text pagination have independent inputs.
const oldPageLayout = settings.pageLayout
// @ts-expect-error The retired content-layout group is not retained as an alias.
const oldFixedGroup = settings.fixedLayout
// @ts-expect-error The retired reflowable group is not retained as an alias.
const oldTextGroup = settings.reflowable
// @ts-expect-error Text pagination accepts one or two generated reading faces.
const excessivePages: ReadingSettings['text']['pagesPerView'] = 3
// @ts-expect-error A manual writing mode names its actual block progression.
const ambiguousWriting: ReadingSettings['text']['writingMode'] = 'vertical'
// @ts-expect-error Following document spacing is explicit rather than an absent value.
const absentSpacing: ReadingSettings['text']['paragraphSpacing'] = null
// @ts-expect-error Document following is not an unspecified automatic page policy.
const automaticProgression: ReadingSettings['pages']['progression'] = 'auto'
// @ts-expect-error Main reading advances only along its documented physical directions.
const unsupportedDirection: ReadingView['forwardDirection'] = 'up'
// @ts-expect-error A display group reserves one or two reading faces.
const excessiveSlots: ReadingView['pageSlots'] = 3
// @ts-expect-error Fixed-page groups always have concrete slots, including in continuous flow.
const fixedWithoutSlots: ReadingView = { ...fixedView, pageSlots: null }
// @ts-expect-error Actual direction is required feedback rather than a setting inferred by the host.
const incompleteView: ReadingView = {
  type: 'reflowable',
  writingMode: 'horizontal-tb',
  pageSlots: 1
}
// @ts-expect-error Delivered view feedback is immutable.
state.view.forwardDirection = 'right'
// @ts-expect-error A layout failure supplies its own explicit reason.
const missingLayoutReason = new ReadingError({ code: 'layoutUnavailable' })
// @ts-expect-error Layout failures do not borrow source-location reasons.
const wrongLayoutReason = new ReadingError({ code: 'layoutUnavailable', reason: 'missingTarget' })

void [
  restored,
  target,
  failure,
  layoutFailure,
  fixedView,
  continuousView,
  layoutFeedback,
  equalStartIds,
  historyAvailability,
  automatic,
  mixed,
  emptyPages,
  emptyQuads,
  domRange,
  element,
  missingReason,
  wrongReason,
  unresolvedColors,
  documentColors,
  resolvedColors,
  documentWithoutBackground,
  documentWithForeground,
  customWithoutForeground,
  customWithoutBackground,
  undiscriminatedColors,
  unclassifiedForeground,
  unresolvedFont,
  displayOrganization,
  independentPresentation,
  oldMode,
  oldPageLayout,
  oldFixedGroup,
  oldTextGroup,
  excessivePages,
  ambiguousWriting,
  absentSpacing,
  automaticProgression,
  unsupportedDirection,
  excessiveSlots,
  fixedWithoutSlots,
  incompleteView,
  missingLayoutReason,
  wrongLayoutReason,
  settings,
  defaults
]
