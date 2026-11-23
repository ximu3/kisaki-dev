import { Show, omit } from 'solid-js'
import { dynamic } from '@solidjs/web'
import type { JSX } from '@solidjs/web'
import type { ButtonProps } from '../button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip'
import styles from './styles.module.css'

/** Native list attributes and the shared presentation for its rows. */
export interface ListProps extends JSX.HTMLAttributes<HTMLUListElement | HTMLOListElement> {
  ordered?: boolean
  variant?: 'framed' | 'plain'
}

/** Renders an unordered catalog or an ordered sequence of items. */
export function List(props: ListProps): JSX.Element {
  const rest = omit(props, 'class', 'ordered', 'variant')
  const Control = dynamic(() => (props.ordered ? 'ol' : 'ul'))
  return (
    <Control
      role="list"
      {...rest}
      class={[styles.list, props.class]}
      data-variant={props.variant ?? 'framed'}
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
  const rest = omit(
    props,
    'class',
    'title',
    'description',
    'icon',
    'accessory',
    'actions',
    'handle',
    'children',
  )

  return (
    <li {...rest} class={[styles.item, props.class]}>
      <Show when={props.icon}>
        <span class={styles.icon} aria-hidden="true">
          {props.icon}
        </span>
      </Show>
      <div class={styles.content}>
        <div class={styles.title}>{props.title}</div>
        <Show when={props.description}>
          <div class={styles.description}>{props.description}</div>
        </Show>
        {props.children}
      </div>
      <Show when={props.accessory}>
        <div class={styles.accessory}>{props.accessory}</div>
      </Show>
      <Show when={props.actions}>
        <div class={styles.actions}>{props.actions}</div>
      </Show>
      {props.handle}
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
  const rest = omit(props, 'label', 'destructive', 'class', 'aria-label')
  return (
    <Tooltip>
      <TooltipTrigger
        {...rest}
        class={[props.destructive ? styles.destructive : undefined, props.class]}
        aria-label={props['aria-label'] ?? props.label}
        size="icon-sm"
        variant="ghost"
      />
      <TooltipContent>{props.label}</TooltipContent>
    </Tooltip>
  )
}
