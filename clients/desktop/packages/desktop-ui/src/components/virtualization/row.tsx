import { createEffect, type Accessor } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type { VirtualItem, Virtualizer } from './viewport'

export function createVirtualRow(virtualizer: Accessor<Virtualizer>, item: Accessor<VirtualItem>) {
  let node!: HTMLElement
  createEffect(
    () => [virtualizer(), item().index],
    ([layout, index]) => layout.observe(node, index),
  )

  return {
    ref(element: HTMLElement) {
      node = element
    },
    get 'data-index'() {
      return item().index
    },
    get style(): JSX.CSSProperties {
      return {
        position: 'absolute',
        'inset-block-start': 0,
        'inset-inline-start': 0,
        'inline-size': '100%',
        transform: `translateY(${item().start}px)`,
      }
    },
  }
}

export function VirtualRow(props: {
  virtualizer: Virtualizer
  item: VirtualItem
  children?: JSX.Element
}): JSX.Element {
  const row = createVirtualRow(
    () => props.virtualizer,
    () => props.item,
  )
  return <div {...row}>{props.children}</div>
}
