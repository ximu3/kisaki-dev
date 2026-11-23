/** @fileoverview Native table parts retain browser layout, headers and text selection. */

import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import styles from './styles.module.css'

/**
 * Renders a native table with shared styling.
 *
 * Callers express row and column relationships through header scope and associations.
 */
export function Table(props: JSX.HTMLAttributes<HTMLTableElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <table {...rest} class={[styles.table, props.class]} />
}

/** Groups column-header rows in a native table head. */
export function TableHeader(
  props: JSX.HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean },
): JSX.Element {
  const rest = omit(props, 'sticky', 'class')
  return (
    <thead {...rest} class={[styles.thead, props.class]} data-sticky={props.sticky || undefined} />
  )
}

/** Groups primary data rows in a styled native table body. */
export function TableBody(props: JSX.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <tbody {...rest} class={[styles.tbody, props.class]} />
}

/** Groups summary or total rows in a styled native table footer. */
export function TableFooter(props: JSX.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <tfoot {...rest} class={[styles.tfoot, props.class]} />
}

/** Renders a native row containing header or data cells. */
export function TableRow(props: JSX.HTMLAttributes<HTMLTableRowElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <tr {...rest} class={[styles.tr, props.class]} />
}

/** Header and data share alignment so numeric columns and row actions have a common edge. */
interface CellAlignment {
  align?: 'start' | 'center' | 'end'
}

/** Renders a header cell whose supplied scope or identity relates it to data cells. */
export function TableHead(
  props: Omit<JSX.ThHTMLAttributes<HTMLTableCellElement>, 'align'> & CellAlignment,
): JSX.Element {
  const rest = omit(props, 'class', 'align')
  return <th {...rest} class={[styles.th, props.class]} data-align={props.align} />
}

/** Renders a data cell with native header-association support. */
export function TableCell(
  props: Omit<JSX.TdHTMLAttributes<HTMLTableCellElement>, 'align'> & CellAlignment,
): JSX.Element {
  const rest = omit(props, 'class', 'align')
  return <td {...rest} class={[styles.td, props.class]} data-align={props.align} />
}

/** Names a table through its native caption. */
export function TableCaption(props: JSX.HTMLAttributes<HTMLTableCaptionElement>): JSX.Element {
  const rest = omit(props, 'class')

  return <caption {...rest} class={[styles.caption, props.class]} />
}
