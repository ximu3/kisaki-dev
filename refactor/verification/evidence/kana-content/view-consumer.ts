/** Verify source geometry, viewport geometry and scoped results remain distinct. */
import type { ReaderWithView, ViewportRect, ViewReadTarget } from './view-contract.js'
import type { NormalizedRect, PageRegion, ReadingLocation } from '../kana-api/contracts.js'

declare const reader: ReaderWithView
declare const region: PageRegion
declare const target: ViewReadTarget
declare function readPixels(
  rect: ViewportRect,
  signal: AbortSignal
): Promise<Uint8Array<ArrayBuffer>>
declare function use(value: unknown): void

async function consume() {
  const bookmark = await reader.readView({ type: 'viewport' }, async (view, signal) => ({
    location: view.location,
    pixels: await readPixels(view.rect, signal)
  }))
  const location: ReadingLocation = bookmark.location
  const pixels: Uint8Array<ArrayBuffer> = bookmark.pixels
  await reader.readView({ type: 'viewport' }, async (view, signal) => {
    if (view.layout === 'reflowable') {
      const text = await reader.getTextContext(view.location, { signal })
      if (text !== null) return { location: view.location, text }
    }
    return { location: view.location, pixels: await readPixels(view.rect, signal) }
  })
  const capturedRegion = await reader.readView(
    { type: 'region', region },
    async (view, signal) => ({
      region: view.region,
      pixels: await readPixels(view.rect, signal)
    })
  )
  await reader.readView(target, async (view) => {
    if (view.type === 'viewport') use(view.location)
    else use(view.region)
  })

  await reader.readView({ type: 'viewport' }, async (view) => {
    // @ts-expect-error A viewport capture is not one canonical source-page region.
    use(view.region)
    // @ts-expect-error Viewport CSS coordinates are not normalized source coordinates.
    const sourceRect: NormalizedRect = view.rect
    use(sourceRect)
  })
  await reader.readView({ type: 'region', region }, async (view) => {
    // @ts-expect-error Region capture does not invent an independent bookmark position.
    use(view.location)
  })
  // @ts-expect-error A region read requires the already-selected canonical source region.
  await reader.readView({ type: 'region' }, async () => {})
  // @ts-expect-error The read callback has an explicit asynchronous completion boundary.
  await reader.readView({ type: 'viewport' }, () => 1)
  use([location, pixels, capturedRegion])
}
void consume
