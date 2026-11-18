/** @fileoverview Arranges item identity, optional metadata and locally scoped actions. */

import { Show, splitProps } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import type { ButtonProps } from '../button/control'
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip/parts'
import styles from './styles.module.css'

/** Native list attributes and the shared presentation for its rows. */
export interface ListProps extends JSX.HTMLAttributes<HTMLUListElement | HTMLOListElement> {
  ordered?: boolean
  variant?: 'framed' | 'plain'
}

/** Renders an unordered catalog or an ordered sequence of items. */
export function List(props: ListProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'ordered', 'variant'])
  return (
    <Dynamic
      component={local.ordered ? 'ol' : 'ul'}
      role="list"
      {...rest}
      class={classes(styles.list, local.class)}
      data-variant={local.variant ?? 'framed'}
    />
  )
}

/** Specifies the visible identity, supplementary content and optional item-specific actions. */
export interface ListItemProps extends Omit<JSX.LiHTMLAttributes<HTMLLIElement>, 'title'> {
  title: JSX.Element
  description?: JSX.Element
  icon?: JSX.Element
  /** Displays persistent row information next to the available actions. */
  accessory?: JSX.Element
  actions?: JSX.Element
  /** Displays an independent ordering handle at the trailing edge. */
  handle?: JSX.Element
}

/** Renders one item with a decorative glyph slot, readable title and actions at the trailing edge. */
export function ListItem(props: ListItemProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'class',
    'title',
    'description',
    'icon',
    'accessory',
    'actions',
    'handle',
    'children',
  ])

  return (
    <li {...rest} class={classes(styles.item, local.class)}>
      <Show when={local.icon}>
        <span class={styles.icon} aria-hidden="true">
          {local.icon}
        </span>
      </Show>
      <div class={styles.content}>
        <div class={styles.title}>{local.title}</div>
        <Show when={local.description}>
          <div class={styles.description}>{local.description}</div>
        </Show>
        {local.children}
      </div>
      <Show when={local.accessory}>
        <div class={styles.accessory}>{local.accessory}</div>
      </Show>
      <Show when={local.actions}>
        <div class={styles.actions}>{local.actions}</div>
      </Show>
      {local.handle}
    </li>
  )
}

/** Supplies the accessible name and visible tooltip of an icon-only row action. */
export interface ListItemActionProps extends Omit<ButtonProps, 'size' | 'variant'> {
  label: string
  destructive?: boolean
}

/** Renders one compact row action with its original button semantics. */
export function ListItemAction(props: ListItemActionProps): JSX.Element {
  const [local, rest] = splitProps(props, ['label', 'destructive', 'class', 'aria-label'])
  return (
    <Tooltip>
      <TooltipTrigger
        {...rest}
        class={classes(local.destructive ? styles.destructive : undefined, local.class)}
        aria-label={local['aria-label'] ?? local.label}
        size="icon-sm"
        variant="ghost"
      />
      <TooltipContent>{local.label}</TooltipContent>
    </Tooltip>
  )
}
