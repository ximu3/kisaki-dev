/** @fileoverview Measures grouped choice rows against their actual popup viewport. */

import { createMemo, For, Show } from 'solid-js'
import type { Accessor, JSX } from 'solid-js'
import { createVirtualizer } from '@tanstack/solid-virtual'
import type { SelectionOption } from './types'
import styles from './styles.module.css'

/** One contiguous group from the logical option collection in display order. */
export interface OptionGroup<O extends SelectionOption> {
  label: string | undefined
  options: O[]
}

/** Flattens group headings and options into one measured axis and reveals a logical option by key. */
export function createVirtualChoices<O extends SelectionOption>(
  groups: Accessor<readonly OptionGroup<O>[]>,
  list: Accessor<HTMLDivElement | undefined>,
  enabled: Accessor<boolean>,
  estimateSize: () => number,
) {
  const entries = createMemo(() =>
    groups().flatMap((group, index) => [
      ...(group.label ? [{ key: 'group:' + index, group, option: undefined }] : []),
      ...group.options.map((option) => ({ key: 'option:' + option.value, group, option })),
    ]),
  )
  const positions = createMemo(() => new Map(entries().map(({ key }, i) => [key, i])))
  const rows = createVirtualizer({
    /** Counts group headings and options in the same measured coordinate space. */
    get count() {
      return entries().length
    },
    /** Pauses virtual measurements when the owner is no longer shown. */
    get enabled() {
      return enabled()
    },
    getScrollElement: () => list() ?? null,
    estimateSize,
    // Apply row corrections outside the observer turn that positions the popup.
    useAnimationFrameWithResizeObserver: true,
    measureElement: (element, entry) =>
      entry?.borderBoxSize[0]?.blockSize ?? parseFloat(getComputedStyle(element).height),
    getItemKey: (index) => entries()[index]!.key,
    overscan: 4,
  })

  function scrollTo(key: string) {
    const index = positions().get('option:' + key)
    if (index !== undefined) {
      rows.scrollToIndex(index, { align: 'auto' })
    }
  }
  const visible = createMemo(() =>
    rows.getVirtualItems().reduce((byGroup, row) => {
      const group = entries()[row.index]?.group
      if (group) {
        const current = byGroup.get(group) ?? []
        current.push(row)
        byGroup.set(group, current)
      }
      return byGroup
    }, new Map<OptionGroup<O>, ReturnType<typeof rows.getVirtualItems>>()),
  )

  function Render(props: { option: (option: O) => JSX.Element }): JSX.Element {
    return (
      <div class={styles.virtualTrack} style={{ height: `${rows.getTotalSize()}px` }}>
        <For each={groups()}>
          {(group) => (
            <Show when={visible().has(group)}>
              <div role={group.label ? 'group' : undefined} aria-label={group.label}>
                <For each={visible().get(group)}>
                  {(row) => (
                    <div
                      class={styles.virtualRow}
                      data-index={row.index}
                      style={{ transform: `translateY(${row.start}px)` }}
                      ref={(node) => {
                        node.dataset.index = String(row.index)
                        rows.measureElement(node)
                      }}
                    >
                      <Show
                        when={entries()[row.index]?.option}
                        fallback={
                          <div class={styles.groupTitle} aria-hidden="true">
                            {group.label}
                          </div>
                        }
                      >
                        {(option) => props.option(option())}
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          )}
        </For>
      </div>
    )
  }

  return { scrollTo, Render }
}
