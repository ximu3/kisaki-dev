import { omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Table, TableBody, TableHeader } from './parts'
import styles from './styles.module.css'

export interface ScrollableTableProps extends JSX.HTMLAttributes<HTMLTableElement> {
  columns: string
  minWidth?: string
  header: JSX.Element

  headerRef?: (element: HTMLTableSectionElement) => void
  viewportRef?: (element: HTMLDivElement) => void
}

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

export function TableSpacer(props: { height: number }): JSX.Element {
  return <tr aria-hidden="true" style={{ height: `${props.height}px` }} />
}
