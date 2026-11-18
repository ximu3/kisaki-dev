/** @fileoverview Accessible tabs with roving focus and independently owned panel content. */

import {
  createContext,
  createEffect,
  createMemo,
  createUniqueId,
  onCleanup,
  splitProps,
  useContext,
  createSignal,
} from 'solid-js'
import type { Accessor, JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { createValue } from '../../internal/state'
import { createFocusNavigation } from '../../internal/focus'
import styles from './styles.module.css'
import segmented from '../../internal/segmented.module.css'

/** Selection, tab registration and keyboard-entry state shared by the tabs compound parts. */
const TabsContext = createContext<{
  id: string

  /** Reads the selected panel value, falling back to the first registered tab when empty. */
  value: Accessor<string>
  /** Requests a selected-tab value through the current value owner. */
  change: (value: string) => void

  /** Reads the enabled registered tab that serves as the list's keyboard entry. */
  focusValue: Accessor<string>
  /** Tracks the tab with actual focus while navigating the list. */
  setFocus: (value: string | undefined) => void
  /** Registers an enabled tab for focus fallback and returns its removal callback. */
  register: (value: string) => () => void

  /** Reads the list orientation used by arrow-key navigation. */
  orientation: Accessor<'horizontal' | 'vertical'>
  /** Reads whether arrow focus also activates the corresponding tab. */
  activation: Accessor<'automatic' | 'manual'>
}>()

/**
 * Controlled or local tab selection with orientation and activation policy.
 *
 * Automatic activation follows arrow focus; manual activation uses Enter or Space. Panels remain
 * mounted.
 */
export interface TabsProps extends JSX.HTMLAttributes<HTMLDivElement> {
  value?: string
  defaultValue?: string
  /** Reports the requested selected-tab value. */
  onValueChange?: (value: string) => void

  orientation?: 'horizontal' | 'vertical'
  activation?: 'automatic' | 'manual'
}

/**
 * Owns tab identity, selection and enabled-tab registration while hidden panels retain local state.
 */
export function Tabs(props: TabsProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'value',
    'defaultValue',
    'onValueChange',
    'orientation',
    'activation',
    'children',
    'class',
  ])

  /** Live selected-tab value and change requests delegated to its value owner. */
  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? '',
    (next) => local.onValueChange?.(next),
  )
  /** Current tab identities in registration order for selection and keyboard entry. */
  const [registered, setRegistered] = createSignal<string[]>([])
  const [focused, setFocus] = createSignal<string>()
  const first = () => registered()[0] ?? ''
  const selection = createMemo<{ requested: string; selected: string; index: number }>(
    (previous) => {
      const items = registered()
      const requested = value()
      const requestedIndex = items.indexOf(requested)
      if (requestedIndex >= 0 || local.value !== undefined) {
        return { requested, selected: requested || first(), index: Math.max(0, requestedIndex) }
      }

      const last = previous?.requested === requested ? previous : undefined
      const retained = last ? items.indexOf(last.selected) : -1
      const index = retained >= 0 ? retained : Math.min(last?.index ?? 0, items.length - 1)
      return { requested, selected: items[index] ?? '', index: Math.max(0, index) }
    },
  )

  return (
    <TabsContext.Provider
      value={{
        id: createUniqueId(),

        /** Reads the owned selection, following the nearest enabled tab after local removal. */
        value: () => selection().selected,
        change,

        /** Reads the registered tab that should receive keyboard entry. */
        focusValue: () => {
          const tabs = registered()
          const entry = focused()
          if (entry && tabs.includes(entry)) {
            return entry
          }
          const selected = selection().selected
          return tabs.includes(selected) ? selected : first()
        },
        setFocus,

        /** Registers a tab identity and returns its matching registration cleanup. */
        register: (item) => {
          setRegistered((items) => [...items, item])
          return () => setRegistered((items) => items.filter((value) => value !== item))
        },

        /** Reads the caller's tab-list orientation with its horizontal default. */
        orientation: () => local.orientation ?? 'horizontal',

        /** Reads the caller's selection-activation mode with its automatic default. */
        activation: () => local.activation ?? 'automatic',
      }}
    >
      <div {...rest} class={local.class}>
        {local.children}
      </div>
    </TabsContext.Provider>
  )
}

/**
 * Renders a tab list with orientation-aware roving navigation and the configured activation policy.
 *
 * A horizontal list scrolls on wheel input when its tabs overflow. A vertical list grows
 * with its tabs so the surrounding rail can own scrolling.
 * Callers name the list when multiple tab sets need distinction.
 */
export function TabList(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const tabs = useTabs()
  let list!: HTMLDivElement
  const [local, rest] = splitProps(props, ['class', 'onKeyDown', 'onFocusOut', 'onWheel', 'ref'])

  /** Orientation-aware tab navigation that applies automatic activation when selected. */
  const navigate = createFocusNavigation(
    () => list,
    '[role="tab"]',
    tabs.orientation,
    (node) => {
      if (tabs.activation() === 'automatic') {
        tabs.change(node.dataset.value!)
      }
    },
  )

  function scroll(event: WheelEvent & { currentTarget: HTMLDivElement; target: Element }) {
    callHandler(local.onWheel, event)
    if (
      event.defaultPrevented ||
      tabs.orientation() !== 'horizontal' ||
      event.ctrlKey ||
      event.shiftKey ||
      event.deltaX ||
      !event.deltaY ||
      list.scrollWidth <= list.clientWidth
    ) {
      return
    }

    const style = getComputedStyle(list)
    let distance = event.deltaY
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      distance *= Number.parseFloat(style.fontSize)
    } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      distance *= list.clientWidth
    }
    const previous = list.scrollLeft
    list.scrollLeft += style.direction === 'rtl' ? -distance : distance
    if (list.scrollLeft !== previous) {
      event.preventDefault()
    }
  }

  return (
    <div
      {...rest}
      ref={(node) => {
        list = node
        assignRef(local.ref, node)
      }}
      role="tablist"
      aria-orientation={tabs.orientation()}
      class={classes(segmented.group, styles.list, local.class)}
      on:wheel={scroll}
      onFocusOut={(event) => {
        if (!list.contains(event.relatedTarget as Node | null)) {
          tabs.setFocus(undefined)
        }
        callHandler(local.onFocusOut, event)
      }}
      onKeyDown={(event) => {
        callHandler(local.onKeyDown, event)
        if (!event.defaultPrevented) {
          navigate(event)
        }
      }}
    />
  )
}

/** Native tab-button attributes with a value unique within the owning Tabs instance. */
export interface TabProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

/** Renders a native tab button and registers enabled choices for roving keyboard entry. */
export function Tab(props: TabProps): JSX.Element {
  const tabs = useTabs()
  const [local, rest] = splitProps(props, ['value', 'class', 'onClick', 'onFocus'])

  createEffect(() => {
    if (!props.disabled) {
      onCleanup(tabs.register(local.value))
    }
  })

  return (
    <button
      type="button"
      {...rest}
      role="tab"
      id={`${tabs.id}-tab-${local.value}`}
      data-value={local.value}
      aria-controls={`${tabs.id}-panel-${local.value}`}
      aria-selected={tabs.value() === local.value}
      tabIndex={tabs.focusValue() === local.value ? 0 : -1}
      class={classes(segmented.item, styles.tab, local.class)}
      onFocus={(event) => {
        tabs.setFocus(local.value)
        callHandler(local.onFocus, event)
      }}
      onClick={(event) => {
        callHandler(local.onClick, event)
        if (!event.defaultPrevented) {
          tabs.change(local.value)
        }
      }}
    />
  )
}

/** Panel attributes and the stable value linking it to its tab. */
export interface TabPanelProps extends JSX.HTMLAttributes<HTMLDivElement> {
  value: string
}

/** Associates a panel with its tab and hides inactive content while keeping it mounted. */
export function TabPanel(props: TabPanelProps): JSX.Element {
  const tabs = useTabs()
  const [local, rest] = splitProps(props, ['value', 'class'])

  return (
    <div
      tabIndex={0}
      {...rest}
      role="tabpanel"
      id={`${tabs.id}-panel-${local.value}`}
      aria-labelledby={`${tabs.id}-tab-${local.value}`}
      hidden={tabs.value() !== local.value}
      class={classes(styles.panel, local.class)}
    />
  )
}

/** Returns the nearest tabs state and rejects parts rendered outside a Tabs owner. */
function useTabs() {
  const tabs = useContext(TabsContext)
  if (!tabs) {
    throw new Error('Tab parts require Tabs.')
  }

  return tabs
}
