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

  value: Accessor<string>
  change: (value: string) => void

  focusValue: Accessor<string>
  register: (value: string) => () => void

  orientation: Accessor<'horizontal' | 'vertical'>
  activation: Accessor<'automatic' | 'manual'>
}>()

/** Automatic activation follows arrow focus; manual activation uses Enter or Space. Panels stay mounted. */
export interface TabsProps extends JSX.HTMLAttributes<HTMLDivElement> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void

  orientation?: 'horizontal' | 'vertical'
  activation?: 'automatic' | 'manual'
}

/** Own the tab choice locally or provide a controlled value. Hidden panels retain their local state. */
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

/** The list needs an accessible name when the page has multiple tab sets. */
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

/** Stable value links the tab and panel; use unique values within one Tabs instance. */
export interface TabProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

/** A native button with roving tabindex. Disabled options are excluded from navigation. */
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

/** The panel's value identifies its tab; hidden content remains mounted until its owner removes it. */
export interface TabPanelProps extends JSX.HTMLAttributes<HTMLDivElement> {
  value: string
}

/** Associate visible panel content and a keyboard entry point with the active tab. */
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

/** Require the local tabs owner when rendering a collaborating part. */
function useTabs() {
  const tabs = useContext(TabsContext)
  if (!tabs) {
    throw new Error('Tab parts require Tabs.')
  }

  return tabs
}
