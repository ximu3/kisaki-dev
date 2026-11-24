import { createEffect, onSettled, type Accessor } from 'solid-js'
import { commitNativeValue, createValue, onFormReset } from './state'
import { nativeValidityChanged } from './form'

export interface TextValueProps {
  value?: string | undefined
  defaultValue?: string | undefined
  onValueChange?: ((value: string) => void) | undefined
}

export function bindTextControl(
  props: TextValueProps,
  element: Accessor<HTMLInputElement | HTMLTextAreaElement>,
) {
  const [value, change] = createValue(
    () => props.value,
    () => props.defaultValue ?? '',
    (next) => props.onValueChange?.(next),
  )
  let composing = false
  const sync = (next = value()) => {
    const node = element()
    if (!composing && node.value !== next) {
      node.value = next
      nativeValidityChanged(node.form)
    }
  }

  onSettled(() => {
    const node = element()
    let active = true
    const start = () => {
      composing = true
    }
    const end = () => {
      composing = false
      queueMicrotask(() => {
        if (active) {
          sync()
        }
      })
    }
    node.addEventListener('compositionstart', start)
    node.addEventListener('compositionend', end)
    return () => {
      active = false
      node.removeEventListener('compositionstart', start)
      node.removeEventListener('compositionend', end)
    }
  })

  createEffect(
    () => [props.defaultValue ?? '', value()],
    ([initial, next]) => {
      element().defaultValue = initial
      sync(next)
    },
  )

  const commit = commitNativeValue(change, sync)

  const flushReset = onFormReset(element, () => commit(props.defaultValue ?? ''))
  return () => {
    const next = element().value
    flushReset()
    commit(next)
  }
}
