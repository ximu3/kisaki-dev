import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import styles from './styles.module.css'

export function Table(props: JSX.HTMLAttributes<HTMLTableElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <table {...rest} class={[styles.table, props.class]} />
}

export function TableHeader(
  props: JSX.HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean },
): JSX.Element {
  const rest = omit(props, 'sticky', 'class')
  return (
    <thead {...rest} class={[styles.thead, props.class]} data-sticky={props.sticky || undefined} />
  )
}

export function TableBody(props: JSX.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <tbody {...rest} class={[styles.tbody, props.class]} />
}

export function TableFooter(props: JSX.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <tfoot {...rest} class={[styles.tfoot, props.class]} />
}

export function TableRow(props: JSX.HTMLAttributes<HTMLTableRowElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <tr {...rest} class={[styles.tr, props.class]} />
}

interface CellAlignment {
  align?: 'start' | 'center' | 'end'
}

export function TableHead(
  props: Omit<JSX.ThHTMLAttributes<HTMLTableCellElement>, 'align'> & CellAlignment,
): JSX.Element {
  const rest = omit(props, 'class', 'align')
  return <th {...rest} class={[styles.th, props.class]} data-align={props.align} />
}

export function TableCell(
  props: Omit<JSX.TdHTMLAttributes<HTMLTableCellElement>, 'align'> & CellAlignment,
): JSX.Element {
  const rest = omit(props, 'class', 'align')
  return <td {...rest} class={[styles.td, props.class]} data-align={props.align} />
}

export function TableCaption(props: JSX.HTMLAttributes<HTMLTableCaptionElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <caption {...rest} class={[styles.caption, props.class]} />
}
