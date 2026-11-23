import { createEffect, createMemo, createSignal, flush } from 'solid-js'
import { RowGeometry } from './geometry'

/** One visible or retained logical row, in CSS pixels from the top of the track. */
export interface VirtualItem {
  index: number
  key: string | number
  start: number
}

/** Half-open logical interval covering the viewport and its overscan. */
export interface VirtualRange {
  first: number
  lastExclusive: number
}

/** Reactive inputs for one logical layout. Estimates and keys are synchronous. */
export interface VirtualizerOptions {
  count: number
  /** The vertical scroll container. The track starts after any supplied sticky header. */
  viewport: HTMLElement | undefined
  /** In-flow header pinned at the start of the viewport for the whole track. */
  stickyHeader?: HTMLElement | undefined
  /** Pauses mounted rows and observers while preserving the geometry of this layout. */
  enabled?: boolean
  /** Number of extra rows on each side of the viewport, four by default. */
  overscan?: number
  /** Additional zero-based row indices that stay mounted in a visible viewport. */
  retained?: readonly number[]
  /** Changes when the query, row order or layout invalidates measured positions. */
  layout?: unknown
  /** Estimates a logical row's positive border-box height in CSS pixels. */
  estimateSize: (index: number) => number
  /** Supplies a unique stable identity within the layout. Defaults to the row index. */
  key?: (index: number) => string | number
}

/** Owns the geometry of a track. Observe a row for the lifetime of its element and index. */
export interface Virtualizer {
  /** Reads the contiguous interval to load, independently of retained interaction rows. */
  range: () => VirtualRange
  /** Reads the current window and retained rows in logical order. */
  items: () => readonly VirtualItem[]
  /** Reads the estimated and measured height of the complete track in CSS pixels. */
  totalSize: () => number
  /** Registers a mounted border box and returns the cleanup for that element and index. */
  observe: (element: HTMLElement, index: number) => () => void
  /** Reveals a row on the next viewport update. Alignment incorporates its first measurement. */
  scrollToIndex: (index: number, align?: ScrollAlignment) => void
}

/** Positions a logical row relative to the viewport. */
type ScrollAlignment = 'nearest' | 'start' | 'center' | 'end'

/** Index and alignment requested for the next viewport update. */
interface ScrollRequest {
  index: number
  align: ScrollAlignment
}

/** Computes the requested top offset from the current row edges. */
function alignedTop(
  rows: RowGeometry,
  index: number,
  align: ScrollAlignment,
  top: number,
  height: number,
): number {
  const start = rows.offset(index)
  const bottom = rows.offset(index + 1) - height
  switch (align) {
    case 'start':
      return start
    case 'end':
      return bottom
    case 'center':
      return (start + bottom) / 2
    case 'nearest':
      if (start < top && bottom <= top) {
        return Math.max(start, bottom)
      }
      if (bottom > top && start >= top) {
        return Math.min(start, bottom)
      }
      return top
  }
}

/** Creates an instance-owned geometry index and observes only mounted rows in a visible viewport. */
export function createVirtualizer(options: VirtualizerOptions): Virtualizer {
  const geometry = createMemo(() => {
    void options.layout
    return new RowGeometry(options.count, options.estimateSize)
  })
  const [revision, revise] = createSignal(0)
  const [view, setView] = createSignal(
    { top: 0, height: 0 },
    {
      equals: (a, b) => a.top === b.top && a.height === b.height,
    },
  )

  const elements = new Map<Element, { index: number; measured: boolean }>()
  const measurements = new Map<Element, number>()
  let observer: ResizeObserver | undefined
  let scheduleUpdate: (() => void) | undefined
  let request: ScrollRequest | undefined

  createEffect(
    () => {
      const viewport = options.enabled !== false ? options.viewport : undefined
      return viewport && { viewport, stickyHeader: options.stickyHeader, rows: geometry() }
    },
    (target) => {
      if (!target) {
        request = undefined
        setView({ top: 0, height: 0 })
        return
      }

      const { viewport, stickyHeader, rows } = target
      const viewportHeight = () =>
        Math.max(0, viewport.clientHeight - (stickyHeader?.offsetHeight ?? 0))
      const nativeAnchoring = viewport.style.getPropertyValue('overflow-anchor')
      const nativeAnchoringPriority = viewport.style.getPropertyPriority('overflow-anchor')
      viewport.style.setProperty('overflow-anchor', 'none')

      let frame = 0
      let reveal: (ScrollRequest & { top: number }) | undefined
      const update = () => {
        frame = 0
        const requested = request
        request = undefined
        const height = viewportHeight()
        const top = viewport.scrollTop
        if (!height) {
          measurements.clear()
          reveal = undefined
          setView({ top, height })
          return
        }
        if (reveal?.top !== top) {
          reveal = undefined
        }

        const anchor = rows.at(top)
        let compensatedTop = top
        let changed = false
        let targetMeasured = false
        for (const [element, size] of measurements) {
          const row = elements.get(element)!
          if (!size || row.index >= options.count) {
            continue
          }

          const delta = rows.measure(row.index, size)
          row.measured = true
          if (row.index < anchor) {
            compensatedTop += delta
          }
          changed ||= delta !== 0
          targetMeasured ||= row.index === reveal?.index
        }
        measurements.clear()

        const alignment = requested ?? (targetMeasured ? reveal : undefined)
        if (alignment && alignment.index < options.count) {
          compensatedTop = alignedTop(
            rows,
            alignment.index,
            alignment.align,
            compensatedTop,
            height,
          )
          const measured = Array.from(elements.values()).some(
            (row) => row.index === alignment.index && row.measured,
          )
          reveal = measured ? undefined : { ...alignment, top }
        }

        const nextTop = Math.max(0, Math.min(rows.offset(options.count) - height, compensatedTop))
        setView({ top: nextTop, height })
        if (changed) {
          revise((value) => value + 1)
        }
        if (nextTop !== top) {
          // Commit the resized track before applying an offset beyond the previous scroll extent.
          flush()
          if (observer !== resizeObserver) {
            return
          }
          viewport.scrollTo({ top: nextTop, behavior: 'instant' })
          const actualTop = viewport.scrollTop
          setView({ top: actualTop, height })
          if (reveal) {
            reveal.top = actualTop
          }
        }
      }

      const schedule = () => {
        if (!frame) {
          frame = requestAnimationFrame(update)
        }
      }
      scheduleUpdate = schedule

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (elements.has(entry.target)) {
            measurements.set(entry.target, entry.borderBoxSize[0]!.blockSize)
          }
        }
        schedule()
      })
      observer = resizeObserver
      resizeObserver.observe(viewport)
      if (stickyHeader) {
        resizeObserver.observe(stickyHeader, { box: 'border-box' })
      }
      for (const [element, row] of elements) {
        row.measured = false
        resizeObserver.observe(element, { box: 'border-box' })
      }
      viewport.addEventListener('scroll', schedule, { passive: true })
      setView({ top: viewport.scrollTop, height: viewportHeight() })
      if (request) {
        schedule()
      }

      return () => {
        resizeObserver.disconnect()
        observer = undefined
        scheduleUpdate = undefined
        measurements.clear()
        viewport.removeEventListener('scroll', schedule)
        cancelAnimationFrame(frame)
        viewport.style.setProperty('overflow-anchor', nativeAnchoring, nativeAnchoringPriority)
      }
    },
  )

  const range = createMemo(
    (): VirtualRange => {
      void revision()
      const { top, height } = view()
      if (!height || options.enabled === false) {
        return { first: 0, lastExclusive: 0 }
      }

      const rows = geometry()
      const overscan = options.overscan ?? 4
      return {
        first: Math.max(0, rows.at(top) - overscan),
        lastExclusive: Math.min(options.count, rows.at(top + height) + 1 + overscan),
      }
    },
    { equals: (a, b) => a.first === b.first && a.lastExclusive === b.lastExclusive },
  )

  const items = createMemo<VirtualItem[]>((previous = []) => {
    const { first, lastExclusive } = range()
    if (first === lastExclusive) {
      return []
    }

    void revision()
    const rows = geometry()
    const indices = new Set<number>()
    for (let index = first; index < lastExclusive; index++) {
      indices.add(index)
    }
    for (const index of options.retained ?? []) {
      if (index >= 0 && index < options.count) {
        indices.add(index)
      }
    }

    const earlier = new Map(previous.map((row) => [row.index, row]))
    return Array.from(indices)
      .sort((a, b) => a - b)
      .map((index) => {
        const key = options.key?.(index) ?? index
        const start = rows.offset(index)
        const row = earlier.get(index)
        return row?.key === key && row.start === start ? row : { index, key, start }
      })
  })

  return {
    range,
    items,
    totalSize: () => {
      revision()
      return geometry().offset(options.count)
    },
    observe(element, index) {
      elements.set(element, { index, measured: false })
      observer?.observe(element, { box: 'border-box' })
      return () => {
        observer?.unobserve(element)
        elements.delete(element)
        measurements.delete(element)
      }
    },
    scrollToIndex(index, align = 'nearest') {
      if (
        options.enabled === false ||
        !options.viewport?.clientHeight ||
        index < 0 ||
        index >= options.count
      ) {
        return
      }

      request = { index, align }
      scheduleUpdate?.()
    },
  }
}
