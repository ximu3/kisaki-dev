/** @fileoverview Pointer following has its own Unovis animation clock. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { VisCrosshair } from '@unovis/solid'
import type { VisCrosshairProps } from '@unovis/solid'
import { createChartDuration } from './motion'

export type CrosshairProps<Datum> = VisCrosshairProps<Datum>

/** Follow the pointer immediately; an explicit duration still respects reduced motion. */
export function Crosshair<Datum>(props: CrosshairProps<Datum>): JSX.Element {
  const [local, rest] = splitProps(props, ['duration'])
  const duration = createChartDuration(() => local.duration, 0)

  return <VisCrosshair {...rest} duration={duration()} />
}
