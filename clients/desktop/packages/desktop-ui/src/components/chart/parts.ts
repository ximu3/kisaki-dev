import { children, createMemo, type Accessor } from 'solid-js'
import type { JSX } from '@solidjs/web'
import {
  ComponentCore,
  type Axis,
  type Crosshair,
  type Tooltip,
  type XYComponentCore,
} from '@unovis/ts'
import type { Selection } from 'd3-selection'

const marker = Symbol('chart part')

export interface ChartDataProps<Datum> {
  data?: Datum[] | undefined
}

interface ChartEngines<Datum, SingleData> {
  series: XYComponentCore<Datum>
  single: ComponentCore<SingleData>
  xAxis: Axis<Datum>
  yAxis: Axis<Datum>
  crosshair: Crosshair<Datum>
  tooltip: Tooltip
}

export interface ChartPart<Engine, Data> {
  readonly data: Data | undefined
  mount(): Engine
  release(): void
}

export type ChartPartLifetime = Pick<ChartPart<unknown, unknown>, 'release'>

type ChartChild<Datum, SingleData> = {
  [Slot in keyof ChartEngines<Datum, SingleData>]: { readonly slot: Slot } & ChartPart<
    ChartEngines<Datum, SingleData>[Slot],
    Slot extends 'single' ? SingleData : Datum[]
  >
}[keyof ChartEngines<Datum, SingleData>]

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

  function read() {
    // Capture inputs in the container's tracked read so engine writes can remain untracked.
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
