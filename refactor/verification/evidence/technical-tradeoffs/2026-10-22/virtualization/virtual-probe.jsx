import { batch, createMemo, createSignal, For, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import { createVirtualizer } from '@tanstack/solid-virtual'

const frames = async (count = 8) => {
  for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame)
}
const assert = (value, message) => {
  if (!value) throw new Error(message)
}
const stats = { estimates: 0, keys: 0 }
let controls
let resolveMounted
const mounted = new Promise((resolve) => {
  resolveMounted = resolve
})
window.probeState = { status: 'running' }

function Fixture() {
  let scroll
  const [count, setCount] = createSignal(0)
  const [mode, setMode] = createSignal('fixed')
  const [columns, setColumns] = createSignal(5)
  const [bump, setBump] = createSignal(-1)
  const rowCount = () => (mode() === 'grid' ? 50 * (1 + Math.ceil(1000 / columns())) : count())
  const shape = (index) => {
    if (mode() !== 'grid')
      return {
        header: false,
        group: 0,
        first: index,
        height: mode() === 'variable' ? 24 + (index % 7) * 7 : 32
      }
    const perGroup = 1 + Math.ceil(1000 / columns())
    const group = Math.floor(index / perGroup)
    const local = index % perGroup
    return {
      header: local === 0,
      group,
      first: group * 1000 + (local - 1) * columns(),
      height: local === 0 ? 28 : 96
    }
  }
  const keyFor = createMemo(() => {
    const currentMode = mode()
    const currentColumns = columns()
    return (index) => {
      stats.keys++
      return `${currentMode}:${currentColumns}:${index}`
    }
  })
  const virtualizer = createVirtualizer({
    get count() {
      return rowCount()
    },
    getScrollElement: () => scroll,
    get getItemKey() {
      return keyFor()
    },
    estimateSize: (index) => {
      stats.estimates++
      return mode() === 'grid' ? shape(index).height : 32
    },
    overscan: 6
  })
  controls = {
    virtualizer,
    scroll: () => scroll,
    setCount,
    setMode,
    setColumns,
    setBump,
    shape,
    rowCount
  }
  onMount(resolveMounted)
  return (
    <div
      ref={scroll}
      style={{ height: '480px', width: '800px', overflow: 'auto', 'overflow-anchor': 'none' }}
    >
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
      >
        <For each={virtualizer.getVirtualItems()}>
          {(row) => {
            const info = () => shape(row.index)
            return (
              <div
                data-index={row.index}
                ref={(element) => virtualizer.measureElement(element)}
                style={{
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  width: '100%',
                  height: `${info().height + (bump() === row.index ? 72 : 0)}px`,
                  transform: `translateY(${row.start}px)`,
                  'box-sizing': 'border-box',
                  border: '1px solid #ccc',
                  display: 'flex'
                }}
              >
                {info().header ? (
                  `Group ${info().group}`
                ) : mode() === 'grid' ? (
                  <For
                    each={Array.from(
                      { length: Math.min(columns(), (info().group + 1) * 1000 - info().first) },
                      (_, i) => info().first + i
                    )}
                  >
                    {(entry) => (
                      <div
                        data-entry={entry}
                        style={{ width: `${100 / columns()}%` }}
                      >
                        Entry {entry % 24000}
                      </div>
                    )}
                  </For>
                ) : (
                  `Entry ${row.index}`
                )}
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}

const dispose = render(() => <Fixture />, document.getElementById('root'))

function snapshot() {
  const container = controls.scroll().getBoundingClientRect()
  const visible = [...document.querySelectorAll('[data-index]')]
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        index: Number(element.dataset.index),
        top: rect.top - container.top,
        bottom: rect.bottom - container.top
      }
    })
    .filter((row) => row.bottom > 0 && row.top < container.height)
    .sort((a, b) => a.index - b.index)
  return {
    visible,
    mountedRows: document.querySelectorAll('[data-index]').length,
    scrollTop: controls.scroll().scrollTop,
    totalSize: controls.virtualizer.getTotalSize()
  }
}

async function run() {
  window.probeState.stage = 'waitingForMount'
  await mounted
  window.probeState.stage = 'mounted'
  const results = []
  for (const [count, mode] of [
    [1000, 'fixed'],
    [10000, 'fixed'],
    [50000, 'fixed'],
    [50000, 'variable']
  ]) {
    stats.estimates = 0
    stats.keys = 0
    window.probeState.stage = `${mode}:${count}`
    const started = performance.now()
    batch(() => {
      controls.setCount(count)
      controls.setMode(mode)
      controls.setBump(-1)
    })
    controls.virtualizer.measure()
    controls.virtualizer.scrollToOffset(0)
    const synchronousMs = performance.now() - started
    await frames(12)
    const initial = snapshot()
    const initialCalls = { ...stats }
    assert(
      initial.visible.length > 0 && initial.mountedRows < 80,
      'Initial rendering must stay bounded.'
    )
    const target = count - 20
    const jumpStarted = performance.now()
    controls.virtualizer.scrollToIndex(target, { align: 'start', behavior: 'auto' })
    const jumpSynchronousMs = performance.now() - jumpStarted
    await frames(16)
    const jumped = snapshot()
    assert(
      jumped.visible.some((row) => row.index === target),
      'Far target must actually be visible.'
    )
    assert(jumped.mountedRows < 80, 'Far rendering must stay bounded.')
    results.push({
      count,
      mode,
      synchronousMs,
      jumpSynchronousMs,
      initial,
      jumped,
      initialCalls,
      afterJumpCalls: { ...stats },
      heapBytes: performance.memory?.usedJSHeapSize ?? null
    })
  }
  controls.virtualizer.scrollToIndex(4000, { align: 'start' })
  await frames(16)
  const before = snapshot()
  const anchor = before.visible[0]
  controls.setBump(anchor.index - 1)
  await frames(12)
  const after = snapshot()
  const same = after.visible.find((row) => row.index === anchor.index)
  assert(
    same && Math.abs(same.top - anchor.top) < 1.1,
    'Resizing an overscan row must preserve the visible anchor.'
  )

  batch(() => {
    controls.setMode('grid')
    controls.setColumns(5)
    controls.setBump(-1)
  })
  controls.virtualizer.measure()
  const entry = 5209
  const rowForEntry = (columns) =>
    Math.floor(entry / 1000) * (1 + Math.ceil(1000 / columns)) +
    1 +
    Math.floor((entry % 1000) / columns)
  const grid = []
  for (const columns of [5, 3]) {
    controls.setColumns(columns)
    controls.virtualizer.measure()
    controls.virtualizer.scrollToIndex(rowForEntry(columns), { align: 'start' })
    await frames(16)
    const target = document.querySelector(`[data-entry="${entry}"]`)
    const rect = target?.getBoundingClientRect()
    const container = controls.scroll().getBoundingClientRect()
    assert(
      rect && rect.bottom > container.top && rect.top < container.bottom,
      'Grid regrouping must locate the requested entry.'
    )
    grid.push({
      columns,
      logicalRows: controls.rowCount(),
      mountedRows: snapshot().mountedRows,
      mountedCards: document.querySelectorAll('[data-entry]').length
    })
  }
  dispose()
  assert(
    document.getElementById('root').childElementCount === 0,
    'Disposal must remove the fixture DOM.'
  )
  window.probeState = {
    status: 'passed',
    results,
    resizeAnchor: { before: anchor, after: same },
    grid,
    disposed: true
  }
}

run().catch((error) => {
  window.probeState = {
    status: 'failed',
    error: { message: error.message, stack: error.stack },
    snapshot: controls ? snapshot() : null
  }
})
