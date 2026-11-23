import { createMemo, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Crosshair as Engine, type CrosshairConfigInterface } from '@unovis/ts'
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
  const duration = createChartDuration(() => props.duration, 0)
  const render = createTooltipViewport()

  const content = createMemo((): Pick<CrosshairConfigInterface<Datum>, 'template'> => {
    const template = props.template
    return template
      ? {
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
