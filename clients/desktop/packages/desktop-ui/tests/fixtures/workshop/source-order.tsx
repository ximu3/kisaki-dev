import { createSignal, For, Show } from 'solid-js'
import {
  ReorderableList,
  ReorderableListItem,
  moveListItems,
  type ListMove,
} from '@kisaki3/desktop-ui/list'

const unavailable = new Set(['B', 'D'])

const selected = new Set(['A', 'C'])

export function SourceOrder() {
  const [order, setOrder] = createSignal<readonly string[]>(['A', 'B', 'C', 'D', 'E'])
  const [reject, setReject] = createSignal(false)
  const [error, setError] = createSignal('')
  const visible = () => order().filter((key) => !unavailable.has(key))

  async function adopt(move: ListMove) {
    setError('')
    await Promise.resolve()
    if (reject()) {
      throw new Error('Source priority changed')
    }

    const next = moveListItems(visible(), move)
    let slot = 0
    setOrder((previous) => previous.map((id) => (unavailable.has(id) ? id : next[slot++]!)))
  }

  return (
    <section>
      <label>
        <input
          type="checkbox"
          checked={reject()}
          onChange={(event) => setReject(event.currentTarget.checked)}
        />
        Reject source changes
      </label>
      <ReorderableList
        aria-label="Source priority"
        variant="plain"
        order={visible()}
        selected={selected}
        labels={{
          first: 'Move to beginning',
          previous: 'Move up',
          next: 'Move down',
          last: 'Move to end',
          moved: (id, position, move) =>
            move.ids.length === 1
              ? `Source ${id} moved to ${position}`
              : `${move.ids.length} sources moved. Source ${id} is at ${position}`,
        }}
        onMove={adopt}
        onMoveError={(reason) => setError(String(reason))}
      >
        <For each={visible()}>
          {(id) => (
            <ReorderableListItem
              value={id}
              title={`Source ${id}`}
              moveLabel={`Move source ${id}`}
              previewLabel={`Source ${id}`}
            />
          )}
        </For>
      </ReorderableList>
      <p data-source-order>{order().join(',')}</p>
      <Show when={error()}>
        <p role="alert">{error()}</p>
      </Show>
    </section>
  )
}
