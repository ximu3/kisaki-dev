/** @fileoverview Semantic table parts keep columns intact inside a horizontal viewport. */

import { splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

/** Place a scroll viewport around the table so narrow screens retain every column. */
export function Table(props: JSX.IntrinsicElements['table']): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <div class="ks-focus max-w-full overflow-x-auto" tabIndex={0}>
      <table {...rest} class={twMerge('w-full border-collapse text-left text-sm', local.class)} />
    </div>
  )
}

/** Group column headings. */
export function TableHeader(props: JSX.IntrinsicElements['thead']): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return <thead {...rest} class={twMerge('text-muted-foreground', local.class)} />
}

/** Group data rows. */
export function TableBody(props: JSX.IntrinsicElements['tbody']): JSX.Element {
  return <tbody {...props} />
}

/** Show one record, with caller-owned selection. */
export function TableRow(props: JSX.IntrinsicElements['tr']): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <tr
      {...rest}
      class={twMerge(
        'ks-box border-b border-border hover:bg-muted/50 aria-selected:bg-accent',
        local.class,
      )}
    />
  )
}

/** Identify a column or row. */
export function TableHead(props: JSX.IntrinsicElements['th']): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <th
      {...rest}
      class={twMerge('whitespace-nowrap px-2 py-1.5 text-start font-medium', local.class)}
    />
  )
}

/** Display one value under its heading. */
export function TableCell(props: JSX.IntrinsicElements['td']): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])
  return <td {...rest} class={twMerge('whitespace-nowrap px-2 py-1', local.class)} />
}

/** Name or describe the table. */
export function TableCaption(props: JSX.IntrinsicElements['caption']): JSX.Element {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <caption
      {...rest}
      class={twMerge('pb-2 text-start text-xs text-muted-foreground', local.class)}
    />
  )
}
