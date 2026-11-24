import { Show, omit } from 'solid-js'
import { dynamic, type JSX } from '@solidjs/web'
import type { ButtonProps } from '../button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip'
import styles from './styles.module.css'

export interface ListProps extends JSX.HTMLAttributes<HTMLUListElement | HTMLOListElement> {
  ordered?: boolean
  variant?: 'framed' | 'plain'
}

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

export interface ListItemProps extends Omit<JSX.LiHTMLAttributes<HTMLLIElement>, 'title'> {
  title: JSX.Element
  description?: JSX.Element
  icon?: JSX.Element
  accessory?: JSX.Element
  actions?: JSX.Element
  handle?: JSX.Element
}

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

export interface ListItemActionProps extends Omit<ButtonProps, 'size' | 'variant'> {
  label: string
  destructive?: boolean
}

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
