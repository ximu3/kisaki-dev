/** Public browser-entry consumption; functions are typechecked and never invoked. */
import {
  openReader,
  openUrlSource,
  createBrowserTemporaryStorage,
  type ByteSource,
  type MemberSource,
  type Reader
} from '@ximu3/kana'
import {
  getStartLocation,
  type ReadingKeyInput,
  type ReadingLocation,
  type ReadingSettings,
  type ReadingSelection
} from '@ximu3/kana/contracts'

declare const container: HTMLElement
declare const settings: ReadingSettings
declare const signal: AbortSignal
declare const input: ByteSource
declare const members: MemberSource
declare const reader: Reader
declare function show(value: unknown): void
declare function handleReadingShortcut(input: ReadingKeyInput): boolean

async function readDocument() {
  const opened = await openReader({
    container,
    source: { type: 'document', data: input, name: 'book.epub' },
    settings,
    assetsBaseUrl: new URL('/reader-assets/', location.href),
    temporaryStorage: createBrowserTemporaryStorage(),
    handleKeyDown: handleReadingShortcut,
    signal
  })
  const stop = opened.observe((state) => {
    show(state.location)
    show({ forwardDirection: state.view.forwardDirection, pageSlots: state.view.pageSlots })
  })
  const stopLinks = opened.on('externalLink', (event) => {
    show(event.url)
  })
  const result: ReadingLocation = await opened.seek('start', { signal })
  const returned: ReadingLocation = await opened.back({ signal })
  const revisited: ReadingLocation = await opened.forward({ signal })
  const reference = opened.getState().referenceView
  if (reference) show(reference.target)
  await opened.closeReference()
  const selection: ReadingSelection | null = await opened.getSelection({ signal })
  const contents = await opened.getNavigation({ signal })
  for (const item of contents) {
    if (item.getLocation) await opened.seek(await item.getLocation({ signal }), { signal })
  }
  for await (const hit of opened.search('佳奈', { signal })) {
    await opened.seek(getStartLocation({ type: 'text', range: hit.range }), { signal })
    break
  }
  const order = await opened.setMarks(
    {
      marks: [{ id: 'opaque-mark', location: { type: 'position', position: result } }],
      selectedId: null,
      style: { color: '#d19d30', opacity: 0.3 }
    },
    { signal }
  )
  show([selection, order, returned, revisited])
  stopLinks()
  stop()
  await opened.close()
}

async function readDirectory() {
  const opened = await openReader({
    container,
    source: { type: 'directory', members },
    settings,
    assetsBaseUrl: '/reader-assets/',
    signal
  })
  await opened.close()
}

async function setReadingColors() {
  await reader.setSettings(
    { ...settings, colors: { type: 'document', background: '#171717' } },
    { signal }
  )
  await reader.setSettings(
    { ...settings, colors: { type: 'custom', foreground: '#eeeeee', background: '#171717' } },
    { signal }
  )
}

async function readUrl() {
  const borrowed = await openUrlSource('https://example.invalid/book.pdf', { signal })
  try {
    const opened = await openReader({
      container,
      source: borrowed.source,
      settings,
      assetsBaseUrl: '/reader-assets/',
      signal
    })
    try {
      show(opened.getState())
    } finally {
      await opened.close()
    }
  } finally {
    await borrowed.dispose()
  }
}

async function rejectInvalidCalls() {
  await openReader({
    container,
    source: new Blob(),
    settings,
    assetsBaseUrl: '/reader-assets/',
    // @ts-expect-error Keyboard ownership must be returned during the native event dispatch.
    handleKeyDown: async () => true
  })
  await openReader({
    container,
    source: new Blob(),
    settings,
    assetsBaseUrl: '/reader-assets/',
    // @ts-expect-error The host receives a plain snapshot, not the private DOM event.
    handleKeyDown: (event: KeyboardEvent) => event.defaultPrevented
  })
  // @ts-expect-error History traversal completes asynchronously with the actual position.
  const immediateHistory: ReadingLocation = reader.back()
  // @ts-expect-error History traversal accepts cancellation options, not a replacement target.
  await reader.forward({ position: 'start' })
  // @ts-expect-error Reference cleanup is not itself cancellable.
  await reader.closeReference({ signal })
  await openReader({
    container,
    // @ts-expect-error Document inputs do not accept volume companions.
    source: { type: 'document', data: input, companions: members },
    settings,
    assetsBaseUrl: '/reader-assets/'
  })
  await openReader({
    container,
    // @ts-expect-error Business identities do not authorize input bytes.
    source: { workId: 'work' },
    settings,
    assetsBaseUrl: '/reader-assets/'
  })
  await openReader({
    container,
    // @ts-expect-error A directory has a member provider, not a document byte source.
    source: { type: 'directory', data: input },
    settings,
    assetsBaseUrl: '/reader-assets/'
  })
  // @ts-expect-error Asset deployment is an explicit browser input.
  await openReader({ container, source: new Blob(), settings })
  // @ts-expect-error State observation does not deliver a complete selection payload.
  reader.observe((selection: ReadingSelection) => {
    show(selection)
  })
  // @ts-expect-error A selection-change notification requires a separate selection read.
  reader.on('selectionChange', (selection: ReadingSelection) => {
    show(selection)
  })
  // @ts-expect-error Selection extraction is asynchronous and may read unloaded content.
  const immediate: ReadingSelection | null = reader.getSelection()
  // @ts-expect-error Search provides an incremental iterator rather than an array.
  const all: readonly unknown[] = reader.search('text')
  // @ts-expect-error A closed reader is not reused to open another document.
  reader.open(new Blob())
  // @ts-expect-error close completes with no invented final-position wrapper.
  const finalLocation: ReadingLocation = await reader.close()
  // @ts-expect-error Rotation accepts the documented quarter turns.
  await reader.setRotation(45)
  // @ts-expect-error An internal book URI is not itself a source position.
  await reader.seek('chapter.xhtml#paragraph')
  // @ts-expect-error External-link notifications contain a URL rather than a DOM event.
  reader.on('externalLink', (event: MouseEvent) => {
    show(event)
  })
  // @ts-expect-error Only the caller owns a borrowed root byte source.
  input.dispose()
  // @ts-expect-error A read returns bytes with an ordinary ArrayBuffer, not text.
  const badSource: ByteSource = { size: 3, read: async () => 'abc' }
  void [immediate, all, finalLocation, badSource, immediateHistory]
}

void [readDocument, readDirectory, readUrl, setReadingColors, rejectInvalidCalls]
