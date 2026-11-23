import { createMemo, For, Show } from 'solid-js'
import type { Accessor } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { VirtualRow } from '../virtualization/row'
import { createVirtualizer, type VirtualItem } from '../virtualization/viewport'
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
  active: Accessor<string | undefined>,
  estimateSize: () => number,
) {
  const entries = createMemo(() =>
    groups().flatMap((group, index) => [
      ...(group.label ? [{ key: 'group:' + index, group, option: undefined }] : []),
      ...group.options.map((option) => ({ key: 'option:' + option.value, group, option })),
    ]),
  )
  const positions = createMemo(() => new Map(entries().map(({ key }, i) => [key, i])))
  const optionIndex = (key: string) => positions().get('option:' + key)
  const retained = createMemo(() => {
    const key = active()
    const index = key === undefined ? undefined : optionIndex(key)
    return index === undefined ? [] : [index]
  })

  const rows = createVirtualizer({
    get count() {
      return entries().length
    },
    get enabled() {
      return enabled()
    },
    get viewport() {
      return list()
    },
    get layout() {
      return entries()
    },
    get retained() {
      return retained()
    },
    estimateSize,
    key: (index) => entries()[index]!.key,
    overscan: 4,
  })

  function scrollTo(key: string) {
    const index = optionIndex(key)
    if (index !== undefined) {
      rows.scrollToIndex(index)
    }
  }

  const visible = createMemo(() =>
    rows.items().reduce((byGroup, row) => {
      const group = entries()[row.index]?.group
      if (group) {
        const current = byGroup.get(group) ?? []
        current.push(row)
        byGroup.set(group, current)
      }
      return byGroup
    }, new Map<OptionGroup<O>, VirtualItem[]>()),
  )

  function Render(props: { option: (option: O) => JSX.Element }): JSX.Element {
    return (
      <div class={styles.virtualTrack} style={{ height: `${rows.totalSize()}px` }}>
        <For each={Array.from(visible().keys())}>
          {(group) => (
            <div role={group.label ? 'group' : undefined} aria-label={group.label}>
              <For each={visible().get(group)} keyed={(row) => row.key}>
                {(row) => (
                  <VirtualRow virtualizer={rows} item={row()}>
                    <Show
                      keyed
                      when={entries()[row().index]?.option}
                      fallback={
                        <div class={styles.groupTitle} aria-hidden="true">
                          {group.label}
                        </div>
                      }
                    >
                      {(option) => props.option(option)}
                    </Show>
                  </VirtualRow>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    )
  }

  return { scrollTo, Render }
}
