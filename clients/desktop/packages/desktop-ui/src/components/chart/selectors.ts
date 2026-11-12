/** @fileoverview Interactive chart selectors expose only public string values. */

import { VisDonutSelectors } from '@unovis/solid'

/** Public donut segment selector for ChartTooltip triggers. */
export const donutSelectors: Readonly<{ segment: string }> = {
  segment: VisDonutSelectors.segment,
}
