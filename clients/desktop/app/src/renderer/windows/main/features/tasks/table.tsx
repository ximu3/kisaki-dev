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
import { mdiArchiveOutline, mdiPlaylistPlay } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import type { TaskRunSummary } from '@kisaki3/desktop-contracts/tasks'
import { Button } from '@kisaki3/desktop-ui/button'
import { EmptyState } from '@kisaki3/desktop-ui/empty-state'
import { Spinner } from '@kisaki3/desktop-ui/spinner'
import { ScrollableTable, TableHead, TableRow, TableSpacer } from '@kisaki3/desktop-ui/table'
import { createVirtualizer } from '@kisaki3/desktop-ui/virtualization'
import type { MainClient } from '../../../../infrastructure/api'
import type { createConfirmation } from '../../../../infrastructure/dialogs/confirmation'
import { errorMessage, reportError } from '../../../../infrastructure/notifications'
import type { TaskQueryState } from './query'
import { TaskRow } from './rows'

interface TaskTableProps {
  api: MainClient
  active: boolean
  visible: boolean
  query: TaskQueryState
  open: (id: string) => void
  confirm: ReturnType<typeof createConfirmation>['ask']
}

interface FocusedRow {
  index: number
  record: TaskRunSummary
  generation: string
}

export function TaskTable(props: TaskTableProps) {
  const { api, query } = props
  let region!: HTMLDivElement

  function emptyHeading() {
    if (query.filtered()) {
      return api.t('tasks.noMatches')
    }
    return api.t(props.active ? 'tasks.noActive' : 'tasks.noFinished')
  }

  async function remove(row: TaskRunSummary, viewport: HTMLDivElement | undefined) {
    if (
      await props.confirm(
        api.t('tasks.history.delete'),
        api.t('actions.delete'),
        api.t('tasks.history.confirmDelete', { name: row.title }),
      )
    ) {
      const last = query.total() === 1
      await api.call('tasks.delete', { taskRunId: row.id })
      const target = !last && viewport?.isConnected ? viewport : region
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
              heading={api.t('controls.feedback.unavailable')}
              description={errorMessage(cause())}
            >
              <Button variant="outline" onClick={query.refresh}>
                {api.t('actions.retry')}
              </Button>
            </EmptyState>
          )}
        </Match>
        <Match when={query.total() === undefined}>
          <div class="grid grow place-items-center">
            <Spinner label={api.t('controls.feedback.loading')} />
          </div>
        </Match>
        <Match when={query.total() === 0}>
          <EmptyState
            class="grow"
            icon={<Icon path={props.active ? mdiPlaylistPlay : mdiArchiveOutline} />}
            heading={emptyHeading()}
          />
        </Match>
        <Match when={query.total()}>
          <RunTable
            {...props}
            remove={(row, viewport) => void remove(row, viewport).catch(reportError)}
          />
        </Match>
      </Switch>
    </div>
  )
}

function RunTable(
  props: TaskTableProps & {
    remove: (record: TaskRunSummary, viewport: HTMLDivElement | undefined) => void
  },
) {
  const { api, query } = props
  const [viewport, setViewport] = createSignal<HTMLDivElement>()
  const [header, setHeader] = createSignal<HTMLTableSectionElement>()
  const estimate = () =>
    2.5 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  const [rowHeight, setRowHeight] = createSignal(estimate())
  onSettled(() => {
    const resize = new ResizeObserver(() => setRowHeight(estimate()))
    resize.observe(header()!)
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
    get stickyHeader() {
      return header()
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
      headerRef={setHeader}
      viewportRef={setViewport}
      aria-label={api.t('tasks.history.title')}
      aria-rowcount={(query.total() ?? 0) + 1}
      onFocusIn={focusRow}
      onFocusOut={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocus(undefined)
        }
      }}
      header={
        <TableRow class="h-8" aria-rowindex={1}>
          <TableHead scope="col">{api.t('tasks.fields.task')}</TableHead>
          <Show when={props.active}>
            <TableHead scope="col">{api.t('tasks.fields.phase')}</TableHead>
          </Show>
          <TableHead align={props.active ? 'start' : 'end'} scope="col">
            {api.t(props.active ? 'tasks.fields.progress' : 'tasks.fields.duration')}
          </TableHead>
          <TableHead scope="col">{api.t('tasks.fields.status')}</TableHead>
          <TableHead align="end" scope="col">
            {api.t('tasks.fields.actions')}
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
            remove={(record) => props.remove(record, viewport())}
          />
        )}
      </For>
    </ScrollableTable>
  )
}
