/** @fileoverview Keeps native radio selection aligned with its value owner after edits and resets. */

import { createEffect, type Accessor } from 'solid-js'
import { nativeValidityChanged } from '../form'
import { createValue, onFormReset } from '../state'

/** Connects a named radio fieldset to one controlled or locally owned selection. */
export function bindRadioSelection(
  group: Accessor<HTMLFieldSetElement>,
  name: Accessor<string>,
  supplied: Accessor<string | undefined>,
  baseline: Accessor<string>,
  changed: (value: string) => void,
) {
  const [value, request] = createValue(supplied, baseline, changed)

  function sync() {
    const selected = value()
    const field = name()
    for (const input of group().querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      if (input.name === field) {
        input.checked = input.value === selected
      }
    }
  }

  const flushReset = onFormReset(group, () => {
    request(baseline())
    sync()
  })
  function change(next: string) {
    flushReset()
    request(next)
    sync()
  }

  createEffect(() => {
    value()
    nativeValidityChanged(group().form)
  })
  return [value, change] as const
}
