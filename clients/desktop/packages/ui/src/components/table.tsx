/** @fileoverview Styles native tables without owning rows, sorting, selection or virtualization. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Native table semantics; place the table in ScrollRegion when horizontal overflow is expected. */
export type TableProps = JSX.IntrinsicElements['table']

/** Present caller-owned tabular data with native table layout. */
export function Table(props: TableProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <table
      {...rest}
      class={twMerge('w-full border-collapse font-ui text-sm text-foreground', local.class)}
    />
  )
}

/** Label a table without replacing its header cells. */
export function TableCaption(props: JSX.HTMLAttributes<HTMLTableCaptionElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <caption
      {...rest}
      class={twMerge('caption-bottom py-2 text-xs text-muted-foreground', local.class)}
    />
  )
}

/** Group column headings. */
export function TableHead(props: JSX.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return <thead {...rest} class={twMerge('bg-muted text-muted-foreground', local.class)} />
}

/** Group caller-owned data rows. */
export function TableBody(props: JSX.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return <tbody {...rest} class={twMerge('[&>tr:last-child]:border-b-0', local.class)} />
}

/** Group totals or other table-level results computed by the caller. */
export function TableFoot(props: JSX.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <tfoot
      {...rest}
      class={twMerge(
        'border-0 border-t border-solid border-border bg-muted font-medium',
        local.class,
      )}
    />
  )
}

/** Arrange cells; selection and activation stay with the consuming view. */
export function TableRow(props: JSX.HTMLAttributes<HTMLTableRowElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <tr
      {...rest}
      class={twMerge(
        'border-0 border-b border-solid border-border hover:bg-accent/50 aria-selected:bg-accent',
        local.class,
      )}
    />
  )
}

/** Supply a real header cell; callers set scope for row headings. */
export function TableHeaderCell(props: JSX.ThHTMLAttributes<HTMLTableCellElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <th
      scope="col"
      {...rest}
      class={twMerge('px-2 py-1.5 text-start align-middle font-medium', local.class)}
    />
  )
}

/** Present data with native colspan, rowspan and header relationships. */
export function TableCell(props: JSX.TdHTMLAttributes<HTMLTableCellElement>): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return <td {...rest} class={twMerge('px-2 py-1.5 align-middle', local.class)} />
}
