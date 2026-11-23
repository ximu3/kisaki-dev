/** @fileoverview Interactive chart selectors expose only public string values. */

import { Donut } from '@unovis/ts'

/** Public donut segment selector for ChartTooltip triggers. */
export const donutSelectors: Readonly<{ segment: string }> = {
  segment: Donut.selectors.segment,
}
