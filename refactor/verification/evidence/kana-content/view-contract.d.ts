/** Proposed scoped view-read addition; the accepted reader contract remains in kana-api. */
import type { CallOptions, Reader } from '../kana-api/browser.js'
import type { PageRegion, ReadingLocation } from '../kana-api/contracts.js'

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
  | {
      readonly type: 'region'
      readonly rect: ViewportRect
      readonly region: PageRegion
    }

export interface ReaderWithView extends Reader {
  readView<Target extends ViewReadTarget, Result>(
    target: Target,
    read: (
      view: Extract<ViewRead, { readonly type: NoInfer<Target>['type'] }>,
      signal: AbortSignal
    ) => Promise<Result>,
    options?: CallOptions
  ): Promise<Result>
}
