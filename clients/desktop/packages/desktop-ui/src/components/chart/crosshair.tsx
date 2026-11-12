/** @fileoverview Pointer following has its own Unovis animation clock. */

import { createMemo, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { VisCrosshair } from '@unovis/solid'
import type { VisCrosshairProps } from '@unovis/solid'
import { createChartDuration } from './motion'
import { createTooltipViewport } from './tooltip'

/** Crosshair data, presentation and tooltip-template options from the official Solid adapter. */
export type CrosshairProps<Datum> = VisCrosshairProps<Datum>

/**
 * Renders pointer-following chart feedback with immediate motion by default.
 *
 * Explicit animation duration still follows reduced-motion preferences.
 */
export function Crosshair<Datum>(props: CrosshairProps<Datum>): JSX.Element {
  const [local, rest] = splitProps(props, ['duration', 'template'])
  const duration = createChartDuration(() => local.duration, 0)
  const render = createTooltipViewport()

  const content = createMemo((): Pick<VisCrosshairProps<Datum>, 'template'> => {
    const template = local.template
    return template
      ? {
          /** Renders the supplied sample template inside the shared stable tooltip viewport. */
          template: (...args) => render(template(...args)),
        }
      : {}
  })
  return <VisCrosshair {...rest} {...content()} duration={duration()} />
}
