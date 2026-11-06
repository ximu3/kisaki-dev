/** @fileoverview Native table parts retain browser layout, headers and text selection. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { classes } from '../../internal/dom'
import styles from './styles.module.css'

/** Native table with shared table styling; use scope/headers to identify column and row relationships. */
export function Table(props: JSX.HTMLAttributes<HTMLTableElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <table {...rest} class={classes(styles.table, local.class)} />
}

/** Group the table's column-header rows in a native thead. */
export function TableHeader(props: JSX.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <thead {...rest} class={classes(styles.thead, local.class)} />
}

/** Group the table's main data rows in a native tbody. */
export function TableBody(props: JSX.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <tbody {...rest} class={classes(styles.tbody, local.class)} />
}

/** Group table summaries or totals in a native tfoot. */
export function TableFooter(props: JSX.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <tfoot {...rest} class={classes(styles.tfoot, local.class)} />
}

/** A native row containing header or data cells. */
export function TableRow(props: JSX.HTMLAttributes<HTMLTableRowElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <tr {...rest} class={classes(styles.tr, local.class)} />
}

/** A native header cell; supply scope or id to express its relationship with data cells. */
export function TableHead(props: JSX.ThHTMLAttributes<HTMLTableCellElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <th {...rest} class={classes(styles.th, local.class)} />
}

/** A native data cell; headers can associate it with explicitly identified header cells. */
export function TableCell(props: JSX.TdHTMLAttributes<HTMLTableCellElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <td {...rest} class={classes(styles.td, local.class)} />
}

/** Give the table an accessible name through its native caption. */
export function TableCaption(props: JSX.HTMLAttributes<HTMLTableCaptionElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return <caption {...rest} class={classes(styles.caption, local.class)} />
}
