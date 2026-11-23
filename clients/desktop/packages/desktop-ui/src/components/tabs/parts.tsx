/** @fileoverview Accessible tabs with roving focus and independently owned panel content. */

import {
  createContext,
  createEffect,
  createMemo,
  createUniqueId,
  omit,
  useContext,
  createSignal,
} from 'solid-js'
import type { Accessor } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../../internal/dom'
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
  const rest = omit(
    props,
    'value',
    'defaultValue',
    'onValueChange',
    'orientation',
    'activation',
    'children',
    'class',
  )

  /** Live selected-tab value and change requests delegated to its value owner. */
  const [value, change] = createValue(
    () => props.value,
    () => props.defaultValue ?? '',
    (next) => props.onValueChange?.(next),
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
      if (requestedIndex >= 0 || props.value !== undefined) {
        return { requested, selected: requested || first(), index: Math.max(0, requestedIndex) }
      }

      const last = previous?.requested === requested ? previous : undefined
      const retained = last ? items.indexOf(last.selected) : -1
      const index = retained >= 0 ? retained : Math.min(last?.index ?? 0, items.length - 1)
      return { requested, selected: items[index] ?? '', index: Math.max(0, index) }
    },
  )

  return (
    <TabsContext
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
        orientation: () => props.orientation ?? 'horizontal',

        /** Reads the caller's selection-activation mode with its automatic default. */
        activation: () => props.activation ?? 'automatic',
      }}
    >
      <div {...rest} class={props.class}>
        {props.children}
      </div>
    </TabsContext>
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
  const tabs = useContext(TabsContext)
  let list!: HTMLDivElement
  const rest = omit(props, 'class', 'onKeyDown', 'onFocusOut', 'onWheel', 'ref')

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
    callHandler(props.onWheel, event)
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
      ref={[
        (node) => {
          list = node
        },
        props.ref,
      ]}
      role="tablist"
      aria-orientation={tabs.orientation()}
      class={[segmented.group, styles.list, props.class]}
      onWheel={scroll}
      onFocusOut={(event) => {
        if (!list.contains(event.relatedTarget as Node | null)) {
          tabs.setFocus(undefined)
        }
        callHandler(props.onFocusOut, event)
      }}
      onKeyDown={(event) => {
        callHandler(props.onKeyDown, event)
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
  const tabs = useContext(TabsContext)
  const rest = omit(props, 'value', 'class', 'onClick', 'onFocus')

  createEffect(
    () => (props.disabled ? undefined : props.value),
    (value) => {
      if (value !== undefined) {
        return tabs.register(value)
      }
    },
  )

  return (
    <button
      type="button"
      {...rest}
      role="tab"
      id={`${tabs.id}-tab-${props.value}`}
      data-value={props.value}
      aria-controls={`${tabs.id}-panel-${props.value}`}
      aria-selected={tabs.value() === props.value ? 'true' : 'false'}
      tabindex={tabs.focusValue() === props.value ? 0 : -1}
      class={[segmented.item, styles.tab, props.class]}
      onFocus={(event) => {
        tabs.setFocus(props.value)
        callHandler(props.onFocus, event)
      }}
      onClick={(event) => {
        callHandler(props.onClick, event)
        if (!event.defaultPrevented) {
          tabs.change(props.value)
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
  const tabs = useContext(TabsContext)
  const rest = omit(props, 'value', 'class')

  return (
    <div
      tabindex={0}
      {...rest}
      role="tabpanel"
      id={`${tabs.id}-panel-${props.value}`}
      aria-labelledby={`${tabs.id}-tab-${props.value}`}
      hidden={tabs.value() !== props.value}
      class={[styles.panel, props.class]}
    />
  )
}
