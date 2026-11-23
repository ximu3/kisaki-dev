/** @fileoverview Pointer following has its own Unovis animation clock. */

import { createMemo, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Crosshair as Engine } from '@unovis/ts'
import type { CrosshairConfigInterface } from '@unovis/ts'
import { createChartDuration } from './motion'
import { chartPart, type ChartDataProps } from './parts'
import { createTooltipViewport } from './tooltip'

/** Crosshair data, presentation and tooltip-template options from the Unovis TypeScript engine. */
export type CrosshairProps<Datum> = CrosshairConfigInterface<Datum> & ChartDataProps<Datum>

/**
 * Renders pointer-following chart feedback with immediate motion by default.
 *
 * Explicit animation duration still follows reduced-motion preferences.
 */
export function Crosshair<Datum>(props: CrosshairProps<Datum>): JSX.Element {
  const rest = omit(props, 'data', 'duration', 'template')
  /** Motion-aware crosshair transition duration with its zero-duration default. */
  const duration = createChartDuration(() => props.duration, 0)
  /** Stable tooltip renderer reused across crosshair samples. */
  const render = createTooltipViewport()

  /** Reactive crosshair-template binding that keeps the tooltip viewport stable. */
  const content = createMemo((): Pick<CrosshairConfigInterface<Datum>, 'template'> => {
    /** Current caller template captured for this reactive binding pass. */
    const template = props.template
    return template
      ? {
          /** Renders the supplied sample template inside the shared stable tooltip viewport. */
          template: (...args) => render(template(...args)),
        }
      : {}
  })
  return chartPart(
    'crosshair',
    () => new Engine<Datum>(),
    () => ({ ...rest, ...content(), duration: duration() }),
    () => props.data,
  )
}
