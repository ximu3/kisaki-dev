/** @fileoverview Accessible tabs with roving focus and independently owned panel content. */

import {
  createContext,
  createEffect,
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

const TabsContext = createContext<{
  id: string

  /** Reads the selected panel value, falling back to the first registered tab when empty. */
  value: Accessor<string>
  /** Requests a selected-tab value through the current value owner. */
  change: (value: string) => void

  /** Reads the enabled registered tab that serves as the list's keyboard entry. */
  focusValue: Accessor<string>
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

  const [value, change] = createValue(
    () => local.value,
    () => local.defaultValue ?? '',
    (next) => local.onValueChange?.(next),
  )
  const [registered, setRegistered] = createSignal<string[]>([])
  /** Returns the first registered enabled-tab value, or an empty value while none exist. */
  const first = () => registered()[0] ?? ''

  return (
    <TabsContext.Provider
      value={{
        id: createUniqueId(),
        value: () => value() || first(),
        change,
        focusValue: () => (registered().includes(value()) ? value() : first()),
        register: (item) => {
          setRegistered((items) => [...items, item])
          return () => setRegistered((items) => items.filter((value) => value !== item))
        },
        orientation: () => local.orientation ?? 'horizontal',
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
 * Callers name the list when multiple tab sets need distinction.
 */
export function TabList(props: JSX.HTMLAttributes<HTMLDivElement>): JSX.Element {
  const tabs = useTabs()
  let list!: HTMLDivElement
  const [local, rest] = splitProps(props, ['class', 'onKeyDown', 'ref'])

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

  return (
    <div
      {...rest}
      ref={(node) => {
        list = node
        assignRef(local.ref, node)
      }}
      role="tablist"
      aria-orientation={tabs.orientation()}
      class={classes(segmented.group, local.class)}
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
  const [local, rest] = splitProps(props, ['value', 'class', 'onClick'])

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
      class={classes(segmented.item, local.class)}
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
