/** @fileoverview A compact single selection for a small group of visible alternatives. */

import type { JSX } from 'solid-js'
import { RadioChoices, type RadioGroupProps } from './radio-group/options'

/** Native radio behavior with adjacent, visibly selected segments. */
export function SegmentedControl(props: RadioGroupProps): JSX.Element {
  return <RadioChoices {...props} segmented />
}
