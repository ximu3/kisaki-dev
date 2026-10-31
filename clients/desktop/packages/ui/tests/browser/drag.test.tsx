/** @fileoverview Verifies reactive drag registration, stable monitors and live-region cleanup. */

import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { createSignal, Show, type JSX } from 'solid-js'
import { render } from 'solid-js/web'
import {
  createDraggable,
  createDropTarget,
  createDragMonitor,
  createDragAutoScroll,
  createDragAnnouncer,
  attachClosestEdge,
  DragHandle,
} from '../../src/drag'
import '@kisaki3/appearance/styles.css'
import '@kisaki3/ui/styles.css'

let dispose: (() => void) | undefined
let root: HTMLDivElement | undefined

afterEach(() => {
  dispose?.()
  root?.remove()
})

/** Mount one ordinary Solid owner, without a desktop session or global drag controller. */
function mount(view: () => JSX.Element): void {
  root = document.createElement('div')
  document.body.append(root)
  dispose = render(view, root)
}

test('dedicated handles report drops to a stable owner and release their registrations', async () => {
  const [mounted, setMounted] = createSignal(true)
  let source!: HTMLDivElement
  let moves = 0
  let keyboardMoves = 0
  let announce: (message: string) => void = () => undefined

  function List(): JSX.Element {
    let container!: HTMLDivElement
    let handle!: HTMLButtonElement
    let target!: HTMLDivElement
    createDraggable(() => ({
      element: source,
      dragHandle: handle,
      getInitialData: () => ({ id: 'first' }),
    }))
    createDropTarget(() => ({
      element: target,
      getData: ({ input, element }) =>
        attachClosestEdge({ id: 'second' }, { input, element, allowedEdges: ['top', 'bottom'] }),
    }))
    createDragAutoScroll(() => ({ element: container }))
    createDragMonitor(() => ({
      onDrop: ({ location }) => {
        if (location.current.dropTargets[0]?.data.id === 'second') {
          moves++
        }
      },
    }))
    announce = createDragAnnouncer()

    return (
      <div
        ref={(element) => {
          container = element
        }}
        style={{ width: '280px', height: '180px', overflow: 'auto' }}
      >
        <div
          ref={(element) => {
            source = element
          }}
          style={{ height: '72px' }}
        >
          <DragHandle
            ref={(element) => {
              handle = element
            }}
            aria-label="Move first"
            onClick={() => {
              keyboardMoves++
            }}
          />
          Selectable text
        </div>
        <div
          ref={(element) => {
            target = element
          }}
          data-testid="target"
          style={{ height: '72px', background: 'var(--muted)' }}
        >
          Second
        </div>
      </div>
    )
  }

  mount(() => (
    <Show when={mounted()}>
      <List />
    </Show>
  ))
  await userEvent.tab()
  await userEvent.keyboard('{Enter}')
  expect(keyboardMoves).toBe(1)
  await userEvent.dragAndDrop(
    page.getByRole('button', { name: 'Move first' }),
    page.getByTestId('target'),
  )
  expect(moves).toBe(1)
  expect(source.draggable).toBe(true)

  announce('Moved')
  await expect.element(page.getByRole('status')).toHaveTextContent('Moved')
  setMounted(false)
  expect(source.hasAttribute('draggable')).toBe(false)
  await expect.element(page.getByRole('status')).not.toBeInTheDocument()
  announce('Late result')
  expect(document.querySelector('[role="status"]')).toBeNull()
})
