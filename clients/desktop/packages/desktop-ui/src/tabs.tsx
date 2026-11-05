/** @fileoverview Linked tab panels with roving keyboard focus and per-instance identifiers. */

import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  onCleanup,
  For,
  Show,
  type JSX,
} from 'solid-js'
import { twMerge } from 'tailwind-merge'

export interface Tab {
  value: string
  label: JSX.Element
  disabled?: boolean
  /** Mounted on first selection. Hidden panels retain local edits until their tab is removed. */
  content: () => JSX.Element
}

export interface TabsProps {
  label: string
  tabs: readonly Tab[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  orientation?: 'horizontal' | 'vertical'
  class?: string
}

/** Arrow keys, Home and End move focus and activate an enabled tab. */
export function Tabs(props: TabsProps): JSX.Element {
  const prefix = createUniqueId()
  const [draft, setDraft] = createSignal(props.defaultValue)
  const enabled = createMemo(() => props.tabs.filter((tab) => !tab.disabled))
  const selected = createMemo(
    () => enabled().find((tab) => tab.value === (props.value ?? draft())) ?? enabled()[0],
  )
  const buttons = new Map<string, HTMLButtonElement>()

  /** Offer the activated tab to its owner. */
  function choose(tab: Tab): void {
    setDraft(tab.value)
    props.onValueChange?.(tab.value)
  }

  /** Move directly between enabled tabs along the configured axis. */
  function navigate(event: KeyboardEvent, tab: Tab): void {
    const tabs = enabled()
    const current = tabs.indexOf(tab)
    let index: number
    const vertical = props.orientation === 'vertical'
    if (event.key === (vertical ? 'ArrowDown' : 'ArrowRight')) {
      index = (current + 1) % tabs.length
    } else if (event.key === (vertical ? 'ArrowUp' : 'ArrowLeft')) {
      index = (current + tabs.length - 1) % tabs.length
    } else if (event.key === 'Home') {
      index = 0
    } else if (event.key === 'End') {
      index = tabs.length - 1
    } else {
      return
    }
    event.preventDefault()
    const next = tabs[index]!
    buttons.get(next.value)?.focus()
    choose(next)
  }

  return (
    <div class={props.class}>
      <div
        role="tablist"
        aria-label={props.label}
        aria-orientation={props.orientation ?? 'horizontal'}
        class={twMerge(
          'inline-flex gap-1 rounded-md bg-muted p-0.5',
          props.orientation === 'vertical' && 'flex-col',
        )}
      >
        <For each={props.tabs}>
          {(tab, i) => {
            let button!: HTMLButtonElement
            createEffect(() => {
              const key = tab.value
              buttons.set(key, button)
              onCleanup(() => buttons.delete(key))
            })
            return (
              <button
                type="button"
                role="tab"
                ref={(element) => {
                  button = element
                }}
                id={prefix + '-tab-' + i()}
                aria-controls={prefix + '-panel-' + i()}
                aria-selected={selected() === tab}
                tabIndex={selected() === tab ? 0 : -1}
                disabled={tab.disabled}
                onClick={() => choose(tab)}
                onKeyDown={(e) => navigate(e, tab)}
                class="ks-control rounded-sm px-2 py-1 text-sm text-muted-foreground aria-selected:bg-surface aria-selected:text-foreground aria-selected:shadow-raised"
              >
                {tab.label}
              </button>
            )
          }}
        </For>
      </div>
      <For each={props.tabs}>
        {(tab, i) => {
          const visited = createMemo<boolean>((previous) => previous || selected() === tab, false)
          return (
            <div
              role="tabpanel"
              tabIndex={0}
              hidden={selected() !== tab}
              id={prefix + '-panel-' + i()}
              aria-labelledby={prefix + '-tab-' + i()}
              class="ks-focus pt-2"
            >
              <Show when={visited()}>{tab.content()}</Show>
            </div>
          )
        }}
      </For>
    </div>
  )
}
