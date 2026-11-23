import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onSettled,
  Show,
  Switch,
} from 'solid-js'
import { ListChecks, ListTodo } from '@lucide/solid'
import type { TaskRunSummary } from '@kisaki3/desktop-contracts/tasks'
import { Button } from '@kisaki3/desktop-ui/button'
import { EmptyState } from '@kisaki3/desktop-ui/empty-state'
import { Spinner } from '@kisaki3/desktop-ui/spinner'
import { ScrollableTable, TableHead, TableRow, TableSpacer } from '@kisaki3/desktop-ui/table'
import { createVirtualizer } from '@kisaki3/desktop-ui/virtualization'
import type { MainClient } from '../../../../infrastructure/api'
import type { createConfirmation } from '../../../../infrastructure/dialogs/confirmation'
import { errorMessage } from '../../../../infrastructure/notifications'
import type { TaskQueryState } from './query'
import { TaskRow } from './rows'

/** Query, visibility and task operations for one independently scrollable tab. */
interface TaskTableProps {
  api: MainClient
  active: boolean
  visible: boolean
  query: TaskQueryState
  open: (id: string) => void
  confirm: ReturnType<typeof createConfirmation>['ask']
  report: (error: unknown) => void
}

/** A focused row can outlive the read buffer while the same history snapshot is displayed. */
interface FocusedRow {
  index: number
  record: TaskRunSummary
  generation: string
}

/** Displays initial loading, empty and failure states without treating unloaded ranges as empty. */
export function TaskTable(props: TaskTableProps) {
  const { api, query } = props
  let region!: HTMLDivElement

  function emptyHeading() {
    if (query.filtered()) {
      return api.t('runtime.noMatches')
    }
    return api.t(props.active ? 'runtime.noActive' : 'runtime.noFinished')
  }

  async function remove(row: TaskRunSummary) {
    if (
      await props.confirm(
        api.t('runtime.deleteTaskAction'),
        api.t('actions.delete'),
        api.t('runtime.deleteTask', { name: row.title }),
      )
    ) {
      const last = query.total() === 1
      await api.call('tasks.delete', { taskRunId: row.id })
      const target = last ? region : (region.querySelector('tbody') ?? region)
      target.focus({ preventScroll: true })
    }
  }

  return (
    <div
      ref={(element) => {
        region = element
      }}
      tabindex={-1}
      class="flex min-h-0 min-w-0 grow flex-col"
    >
      <Switch>
        <Match when={query.error()}>
          {(cause) => (
            <EmptyState
              class="grow"
              heading={api.t('runtime.unavailable')}
              description={errorMessage(cause())}
            >
              <Button variant="outline" onClick={query.refresh}>
                {api.t('runtime.retry')}
              </Button>
            </EmptyState>
          )}
        </Match>
        <Match when={query.total() === undefined}>
          <div class="grid grow place-items-center">
            <Spinner label={api.t('runtime.loading')} />
          </div>
        </Match>
        <Match when={query.total() === 0}>
          <EmptyState
            class="grow"
            icon={props.active ? <ListTodo /> : <ListChecks />}
            heading={emptyHeading()}
          />
        </Match>
        <Match when={query.total()}>
          <RunTable {...props} remove={(row) => void remove(row).catch(props.report)} />
        </Match>
      </Switch>
    </div>
  )
}

/** Connects the table body's geometry to bounded reads and the mounted rows to real task IDs. */
function RunTable(props: TaskTableProps & { remove: (record: TaskRunSummary) => void }) {
  const { api, query } = props
  const [viewport, setViewport] = createSignal<HTMLTableSectionElement>()
  let header!: HTMLTableRowElement
  const estimate = () =>
    2.5 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  const [rowHeight, setRowHeight] = createSignal(estimate())
  onSettled(() => {
    const resize = new ResizeObserver(() => setRowHeight(estimate()))
    resize.observe(header)
    return () => resize.disconnect()
  })

  const [focus, setFocus] = createSignal<{ id: string; index: number }>()
  const held = createMemo<FocusedRow | undefined>((previous) => {
    const target = focus()
    if (!target) {
      return undefined
    }
    const generation = query.generation()
    const record = query.rowAt(target.index)
    if (record) {
      return record.id === target.id ? { record, index: target.index, generation } : undefined
    }
    return previous?.record.id === target.id && previous.generation === generation
      ? previous
      : undefined
  })
  function recordAt(index: number) {
    const row = query.rowAt(index)
    if (row) {
      return row
    }
    const retained = held()
    return retained?.index === index ? retained.record : undefined
  }

  const virtual = createVirtualizer({
    get count() {
      return query.total() ?? 0
    },
    get viewport() {
      return viewport()
    },
    get enabled() {
      return props.visible
    },
    get layout() {
      return query.generation()
    },
    get retained() {
      const target = held()
      return target ? [target.index] : []
    },
    estimateSize: rowHeight,
    key: (index) => recordAt(index)?.id ?? index,
  })
  createEffect(virtual.range, ({ first, lastExclusive }) => {
    if (first < lastExclusive) {
      query.requestRange(first, lastExclusive)
    }
  })

  function focusRow(event: FocusEvent) {
    const row =
      event.target instanceof Element ? event.target.closest('tbody tr[aria-rowindex]') : null
    const index = Number(row?.getAttribute('aria-rowindex')) - 2
    const record = row && recordAt(index)
    setFocus(record ? { index, id: record.id } : undefined)
  }

  return (
    <ScrollableTable
      class="min-h-0 grow"
      columns={
        props.active ? 'minmax(0, 1fr) 10rem 10rem 7rem 9.5rem' : 'minmax(0, 1fr) 6rem 7rem 7rem'
      }
      minWidth={props.active ? '47rem' : '34rem'}
      bodyRef={setViewport}
      aria-label={api.t('runtime.history')}
      aria-rowcount={(query.total() ?? 0) + 1}
      onFocusIn={focusRow}
      onFocusOut={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocus(undefined)
        }
      }}
      header={
        <TableRow
          ref={(element) => {
            header = element
          }}
          class="h-8"
          aria-rowindex={1}
        >
          <TableHead scope="col">{api.t('runtime.task')}</TableHead>
          <Show when={props.active}>
            <TableHead scope="col">{api.t('runtime.phase')}</TableHead>
          </Show>
          <TableHead align={props.active ? 'start' : 'end'} scope="col">
            {api.t(props.active ? 'runtime.progress' : 'runtime.duration')}
          </TableHead>
          <TableHead scope="col">{api.t('runtime.filter')}</TableHead>
          <TableHead align="end" scope="col">
            {api.t('runtime.actions')}
          </TableHead>
        </TableRow>
      }
    >
      <TableSpacer height={virtual.totalSize()} />
      <For each={virtual.items()} keyed={(item) => item.key}>
        {(item) => (
          <TaskRow
            api={api}
            active={props.active}
            virtualizer={virtual}
            item={item()}
            row={recordAt(item().index)}
            open={props.open}
            remove={props.remove}
            report={props.report}
          />
        )}
      </For>
    </ScrollableTable>
  )
}
