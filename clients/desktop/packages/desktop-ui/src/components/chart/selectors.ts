/** @fileoverview Interactive chart selectors expose only public string values. */

import { VisDonutSelectors } from '@unovis/solid'

/** Use the segment selector as a ChartTooltip trigger. */
export const donutSelectors: Readonly<{ segment: string }> = {
  segment: VisDonutSelectors.segment,
}
