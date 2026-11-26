import { createEffect, type Accessor } from 'solid-js'
import { nativeValidityChanged } from '../form'
import { commitNativeValue, createValue, onFormReset } from '../state'

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

  const commit = commitNativeValue(request, sync)
  const flushReset = onFormReset(group, () => commit(baseline()))
  function change(next: string) {
    flushReset()
    commit(next)
  }

  createEffect(
    () => value(),
    () => {
      nativeValidityChanged(group().form)
    },
  )
  return [value, change] as const
}
