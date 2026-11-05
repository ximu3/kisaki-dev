/** @fileoverview The host owns source selection, visible slots, target readiness and commitment. */

import { createSignal, For, Show } from 'solid-js'
import {
  createDragController,
  DragHandle,
  DropIndicator,
  type MoveIntent,
} from '@kisaki3/desktop-ui/drag'
import { Button } from '@kisaki3/desktop-ui/button'

export default function Order() {
  const [order, setOrder] = createSignal(['A', 'B', 'C', 'D', 'E'])
  const [filter, setFilter] = createSignal(false)
  const [group, setGroup] = createSignal(false)
  const [pending, setPending] = createSignal(false)
  const [mounted, setMounted] = createSignal(true)
  const [grid, setGrid] = createSignal(false)
  const [reject, setReject] = createSignal(false)
  const [result, setResult] = createSignal('')
  const visible = () => order().filter((id) => !filter() || !['B', 'D'].includes(id))

  function List() {
    let list!: HTMLDivElement
    const [pastFirstRow, setPastFirstRow] = createSignal(false)
    function apply({ sourceIds, targetId, position }: MoveIntent): void {
      if (reject()) {
        setOrder(['D', 'C', 'B', 'A', 'E'])
        setResult('Library order changed')
        return
      }
      const before = visible()
      const after = before.filter((id) => !sourceIds.includes(id))
      after.splice(after.indexOf(targetId) + Number(position === 'after'), 0, ...sourceIds)
      let i = 0
      setOrder(order().map((id) => (before.includes(id) ? after[i++]! : id)))
      controller.announce('Reading order updated')
    }
    const controller = createDragController({
      sources: (id) =>
        group() && ['A', 'C'].includes(id)
          ? visible().filter((key) => key === 'A' || key === 'C')
          : [id],
      canMove: () => !pending(),
      onMove: apply,
    })
    controller.scrollArea(() => list)
    function Row(props: { id: string }) {
      let row!: HTMLDivElement
      controller.target(
        () => row,
        () => (pending() ? undefined : props.id),
        () => (grid() ? 'horizontal' : 'vertical'),
      )
      return (
        <div
          ref={(element) => {
            row = element
          }}
          data-row={props.id}
          class="order-row"
        >
          <DragHandle
            controller={controller}
            itemId={props.id}
            label={'Move ' + props.id}
            moves={[
              { label: 'To start', targetId: visible()[0]!, position: 'before' },
              { label: 'To end', targetId: visible().at(-1)!, position: 'after' },
            ]}
          >
            ↕
          </DragHandle>{' '}
          {props.id}
          <DropIndicator
            edge={
              controller.indicator()?.targetId === props.id
                ? controller.indicator()?.edge
                : undefined
            }
          />
        </div>
      )
    }
    return (
      <div
        ref={(element) => {
          list = element
        }}
        id="titles"
        aria-label="Titles"
        classList={{ grid: grid() }}
        onScroll={() => setPastFirstRow(list.scrollTop >= 42)}
      >
        <For each={visible()}>
          {(id, index) => (
            <Show
              when={grid() || index() !== 0 || !pastFirstRow()}
              fallback={<div class="order-row" aria-hidden="true" />}
            >
              <Row id={id} />
            </Show>
          )}
        </For>
      </div>
    )
  }
  return (
    <section>
      <h2>Reading order</h2>
      <div class="actions">
        <Button onClick={() => setFilter(!filter())}>Filter titles</Button>
        <Button onClick={() => setGroup(!group())}>Select A and C</Button>
        <Button onClick={() => setPending(!pending())}>Toggle availability</Button>
        <Button onClick={() => setGrid(!grid())}>Switch layout</Button>
        <Button onClick={() => setMounted(!mounted())}>Toggle list</Button>
        <Button onClick={() => setReject(!reject())}>Reject next move</Button>
      </div>
      <Show when={mounted()}>
        <List />
      </Show>
      <output id="order">{order().join('')}</output>
      <output>{result()}</output>
    </section>
  )
}
