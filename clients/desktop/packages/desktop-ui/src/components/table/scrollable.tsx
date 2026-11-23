import { omit, onSettled } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Table, TableBody, TableHeader } from './parts'
import styles from './styles.module.css'

/** Layout and content for a table whose body scrolls inside a constrained parent. */
export interface ScrollableTableProps extends JSX.HTMLAttributes<HTMLTableElement> {
  /** Content-independent CSS grid tracks, such as lengths and `minmax(0, 1fr)`. */
  columns: string
  /** Minimum CSS inline size of each row before horizontal scrolling takes over. */
  minWidth?: string
  /** Header rows and their column headings. */
  header: JSX.Element

  /** Supplies the focusable body viewport at mount for scrolling or virtualization. */
  bodyRef?: (element: HTMLTableSectionElement) => void
}

/**
 * Renders one table with a fixed header and a body that owns both native scroll axes. Use one cell
 * per track in source order and `scope` on column and row headings. Positioned rows use the body
 * as their containing block.
 */
export function ScrollableTable(props: ScrollableTableProps): JSX.Element {
  const rest = omit(props, 'class', 'columns', 'minWidth', 'header', 'bodyRef', 'children')
  const layout = () => ({
    '--kui-table-columns': props.columns,
    '--kui-table-min-width': props.minWidth ?? '0',
  })

  let header!: HTMLTableSectionElement
  let body!: HTMLTableSectionElement
  let headerOffset = 0

  function followBody() {
    if (body.scrollLeft !== headerOffset) {
      header.scrollLeft = body.scrollLeft
      headerOffset = header.scrollLeft
    }
  }

  function followHeader() {
    // Relay native focus scrolling and ignore the scroll notification from followBody.
    if (header.scrollLeft !== headerOffset) {
      headerOffset = header.scrollLeft
      body.scrollLeft = headerOffset
    }
  }

  onSettled(() => {
    // Chromium counts the classic hidden gutter toward the header's horizontal scrollport.
    // Reserve that space with a border to match the body's scroll range.
    const resize = new ResizeObserver(([entry]) => {
      const gutter = entry!.borderBoxSize[0]!.inlineSize - entry!.contentBoxSize[0]!.inlineSize
      header.style.setProperty('--kui-table-gutter', `${gutter}px`)
    })
    resize.observe(body)
    return () => resize.disconnect()
  })

  return (
    <Table {...rest} class={[styles.scrollTable, props.class]} role="table">
      <TableHeader
        ref={(element) => {
          header = element
        }}
        class={[styles.scrollSection, styles.scrollHeader]}
        style={layout()}
        onScroll={followHeader}
      >
        {props.header}
      </TableHeader>
      <TableBody
        ref={(element) => {
          body = element
          props.bodyRef?.(element)
        }}
        class={[styles.scrollSection, styles.scrollBody]}
        style={layout()}
        tabindex={0}
        onScroll={followBody}
      >
        {props.children}
      </TableBody>
    </Table>
  )
}

/** Reserves vertical scroll extent in a ScrollableTable, measured in CSS pixels. */
export function TableSpacer(props: { height: number }): JSX.Element {
  return <tr aria-hidden="true" style={{ height: `${props.height}px` }} />
}
