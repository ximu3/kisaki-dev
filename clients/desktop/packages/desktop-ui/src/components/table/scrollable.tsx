import { omit } from 'solid-js'
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

  /** Supplies the sticky header section, including all header rows. */
  headerRef?: (element: HTMLTableSectionElement) => void
  /** Supplies the focusable scroll viewport at mount for scrolling or virtualization. */
  viewportRef?: (element: HTMLDivElement) => void
}

/**
 * Renders one table in a native scroll viewport with a sticky header. The viewport receives
 * class and style. Use one cell per track in source order and scope on column and row headings.
 * Positioned rows use the body as their containing block.
 */
export function ScrollableTable(props: ScrollableTableProps): JSX.Element {
  const rest = omit(
    props,
    'class',
    'style',
    'dir',
    'columns',
    'minWidth',
    'header',
    'headerRef',
    'viewportRef',
    'children',
  )

  return (
    <div
      class={[styles.scrollViewport, props.class]}
      style={props.style}
      dir={props.dir}
      tabindex={0}
      ref={props.viewportRef}
    >
      <Table
        {...rest}
        class={styles.scrollTable}
        role="table"
        style={{
          '--kui-table-columns': props.columns,
          'min-inline-size': props.minWidth,
        }}
      >
        <TableHeader class={styles.scrollSection} sticky ref={props.headerRef}>
          {props.header}
        </TableHeader>
        <TableBody class={[styles.scrollSection, styles.scrollBody]}>{props.children}</TableBody>
      </Table>
    </div>
  )
}

/** Reserves vertical scroll extent in a ScrollableTable, measured in CSS pixels. */
export function TableSpacer(props: { height: number }): JSX.Element {
  return <tr aria-hidden="true" style={{ height: `${props.height}px` }} />
}
