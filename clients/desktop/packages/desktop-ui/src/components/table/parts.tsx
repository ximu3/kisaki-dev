/** @fileoverview Native table parts retain browser layout, headers and text selection. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/**
 * Renders a native table with shared styling.
 *
 * Callers express row and column relationships through header scope and associations.
 */
export function Table(props: JSX.HTMLAttributes<HTMLTableElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <table {...rest} class={classes(styles.table, local.class)} />
}

/** Groups column-header rows in a native table head. */
export function TableHeader(props: JSX.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  return <thead {...props} />
}

/** Groups primary data rows in a styled native table body. */
export function TableBody(props: JSX.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <tbody {...rest} class={classes(styles.tbody, local.class)} />
}

/** Groups summary or total rows in a styled native table footer. */
export function TableFooter(props: JSX.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <tfoot {...rest} class={classes(styles.tfoot, local.class)} />
}

/** Renders a native row containing header or data cells. */
export function TableRow(props: JSX.HTMLAttributes<HTMLTableRowElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <tr {...rest} class={classes(styles.tr, local.class)} />
}

/** Renders a header cell whose supplied scope or identity relates it to data cells. */
export function TableHead(props: JSX.ThHTMLAttributes<HTMLTableCellElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <th {...rest} class={classes(styles.th, local.class)} />
}

/** Renders a data cell with native header-association support. */
export function TableCell(props: JSX.TdHTMLAttributes<HTMLTableCellElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <td {...rest} class={classes(styles.td, local.class)} />
}

/** Names a table through its native caption. */
export function TableCaption(props: JSX.HTMLAttributes<HTMLTableCaptionElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <caption {...rest} class={classes(styles.caption, local.class)} />
}
