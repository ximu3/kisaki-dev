import { children, createMemo } from 'solid-js'
import type { Accessor } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { ComponentCore } from '@unovis/ts'
import type { Axis, Crosshair, Tooltip, XYComponentCore } from '@unovis/ts'
import type { Selection } from 'd3-selection'

/** Private identity carried by each chart child. */
const marker = Symbol('chart part')

/** Every data-bearing chart child can override the container's data. */
export interface ChartDataProps<Datum> {
  data?: Datum[] | undefined
}

/** Engine type expected at each position in a chart composition. */
interface ChartEngines<Datum, SingleData> {
  series: XYComponentCore<Datum>
  single: ComponentCore<SingleData>
  xAxis: Axis<Datum>
  yAxis: Axis<Datum>
  crosshair: Crosshair<Datum>
  tooltip: Tooltip
}

/** Identity and operations for one child with its current reactive data and configuration. */
export interface ChartPart<Engine, Data> {
  readonly data: Data | undefined
  /** Creates the engine on first use and applies new configuration before returning it. */
  mount(): Engine
  /** Releases the engine when this child leaves the active composition. */
  release(): void
}

/** Releases the resources belonging to an active chart child. */
export type ChartPartLifetime = Pick<ChartPart<unknown, unknown>, 'release'>

/** The child's slot determines its engine and dataset types inside a container. */
type ChartChild<Datum, SingleData> = {
  [Slot in keyof ChartEngines<Datum, SingleData>]: { readonly slot: Slot } & ChartPart<
    ChartEngines<Datum, SingleData>[Slot],
    Slot extends 'single' ? SingleData : Datum[]
  >
}[keyof ChartEngines<Datum, SingleData>]

/** Encodes reactive chart input in a Solid child without creating an engine until it is selected. */
export function chartPart<
  Config extends object,
  Engine extends {
    setConfig(config: Config): void
    destroy(): void
  },
>(
  slot: keyof ChartEngines<never, never> | Accessor<keyof ChartEngines<never, never>>,
  create: () => Engine,
  config: Accessor<Config>,
  data?: Accessor<unknown>,
): JSX.Element {
  let engine: Engine | undefined
  let applied: Config | undefined
  const configuration = createMemo(() => ({ ...config() }))

  function release(): void {
    if (engine instanceof ComponentCore) {
      engine._setUpComponentEventsThrottled.cancel()
      engine._setCustomAttributesThrottled.cancel()
      const group = engine.g as Selection<SVGGElement, unknown, null, undefined>
      group.selectAll('*').interrupt()
      group.interrupt().interrupt('animating')
    }
    engine?.destroy()
    engine = undefined
    applied = undefined
  }

  // Capture inputs in the container's tracked read so engine writes can remain untracked.
  function read() {
    const value = configuration()
    return {
      slot: typeof slot === 'function' ? slot() : slot,
      data: data?.(),
      mount() {
        engine ??= create()
        if (value !== applied) {
          engine.setConfig(value)
          applied = value
        }
        return engine
      },
      release,
    }
  }

  return Object.assign(document.createComment('chart'), { [marker]: read })
}

/** Reads chart parts in JSX order, including conditional and repeated children. */
export function chartParts<Datum, SingleData = Datum[]>(
  content: Accessor<JSX.Element>,
): Accessor<ChartChild<Datum, SingleData>[]> {
  const resolved = children(content)
  return () =>
    Array.from(new Set(resolved.toArray())).flatMap((node) =>
      node instanceof Comment && marker in node
        ? [(node[marker] as Accessor<ChartChild<Datum, SingleData>>)()]
        : [],
    )
}

/** Releases removed children before replacements attach and reports whether anything was removed. */
export function releaseRemoved(
  previous: readonly ChartPartLifetime[],
  current: readonly ChartPartLifetime[],
): boolean {
  const retained = new Set(current.map((child) => child.release))
  let removed = false
  for (const child of previous) {
    if (!retained.has(child.release)) {
      child.release()
      removed = true
    }
  }
  return removed
}
