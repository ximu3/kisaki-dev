/** @fileoverview Owns one task query, its page position and stable, visible run identities. */

import { createEffect, createMemo, For, Match, on, Show, Switch } from 'solid-js'
import { ListChecks, ListTodo } from 'lucide-solid'
import { Button } from '@kisaki3/desktop-ui/button'
import { EmptyState } from '@kisaki3/desktop-ui/empty-state'
import { ScrollArea } from '@kisaki3/desktop-ui/scroll-area'
import { Spinner } from '@kisaki3/desktop-ui/spinner'
import { Table, TableHeader, TableHead, TableBody, TableRow } from '@kisaki3/desktop-ui/table'
import { Toolbar } from '@kisaki3/desktop-ui/toolbar'
import type { MainClient } from '../../../../infrastructure/api'
import type { createConfirmation } from '../../../../infrastructure/dialogs/confirmation'
import { errorMessage } from '../../../../infrastructure/notifications'
import { ActiveRow, FinishedRow } from './rows'
import { taskPageSize, type TaskQueryState } from './query'

/** Keeps each scope's filters, pagination and scroll position while another surface is open. */
export function HistoryList(props: {
  api: MainClient
  active: boolean
  query: TaskQueryState
  open: (id: string) => void
  confirm: ReturnType<typeof createConfirmation>['ask']
  report: (error: unknown) => void
}) {
  const { api } = props
  const { query } = props
  const result = query.page
  const rows = createMemo(() => new Map(result()?.items.map((row) => [row.id, row])))
  const ids = () => [...rows().keys()]
  let viewport!: HTMLDivElement

  createEffect(
    on(
      query.key,
      () => {
        viewport.scrollTop = 0
      },
      { defer: true },
    ),
  )
  createEffect(() => {
    const page = result()
    if (page && query.offset() > 0 && query.offset() >= page.total) {
      query.setOffset(Math.max(0, Math.floor((page.total - 1) / taskPageSize) * taskPageSize))
    }
  })

  function emptyHeading() {
    if (query.filtered()) {
      return api.t('runtime.noMatches')
    }
    return api.t(props.active ? 'runtime.noActive' : 'runtime.noFinished')
  }

  async function remove(id: string) {
    const row = rows().get(id)!
    if (
      await props.confirm(
        api.t('runtime.deleteTaskAction'),
        api.t('actions.delete'),
        api.t('runtime.deleteTask', { name: row.title }),
      )
    ) {
      await api.call('tasks.delete', { taskRunId: id })
      viewport.focus({ preventScroll: true })
    }
  }

  return (
    <>
      <ScrollArea
        ref={(element) => {
          viewport = element
        }}
        class="min-h-0 grow"
        aria-label={api.t('runtime.history')}
      >
        <Switch>
          <Match when={query.error()}>
            <EmptyState
              class="h-full"
              heading={api.t('runtime.unavailable')}
              description={errorMessage(query.error())}
            >
              <Button variant="outline" onClick={query.refresh}>
                {api.t('runtime.retry')}
              </Button>
            </EmptyState>
          </Match>
          <Match when={!result()}>
            <div class="grid h-full place-items-center">
              <Spinner label={api.t('runtime.loading')} />
            </div>
          </Match>
          <Match when={!ids().length}>
            <EmptyState
              class="h-full"
              icon={props.active ? <ListTodo /> : <ListChecks />}
              heading={emptyHeading()}
            />
          </Match>
          <Match when={result()}>
            <Table class={props.active ? 'min-w-[47rem] table-fixed' : 'min-w-[34rem] table-fixed'}>
              <colgroup>
                <col />
                <Show when={props.active}>
                  <col class="w-40" />
                </Show>
                <col class={props.active ? 'w-40' : 'w-24'} />
                <col class="w-28" />
                <col class={props.active ? 'w-38' : 'w-28'} />
              </colgroup>
              <TableHeader sticky>
                <TableRow class="h-8">
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
              </TableHeader>
              <TableBody>
                <For each={ids()}>
                  {(id) =>
                    props.active ? (
                      <ActiveRow
                        api={api}
                        row={rows().get(id)!}
                        open={() => props.open(id)}
                        report={props.report}
                      />
                    ) : (
                      <FinishedRow
                        api={api}
                        row={rows().get(id)!}
                        open={() => props.open(id)}
                        remove={() => void remove(id).catch(props.report)}
                      />
                    )
                  }
                </For>
              </TableBody>
            </Table>
          </Match>
        </Switch>
      </ScrollArea>

      <Show when={query.offset() > 0 || (result()?.total ?? 0) > taskPageSize}>
        <Toolbar class="shrink-0 justify-end border-t border-border px-4 py-1.5">
          <Button
            variant="outline"
            disabled={!query.offset()}
            onClick={() => query.setOffset(query.offset() - taskPageSize)}
          >
            {api.t('runtime.previous')}
          </Button>
          <Button
            variant="outline"
            disabled={query.offset() + taskPageSize >= (result()?.total ?? 0)}
            onClick={() => query.setOffset(query.offset() + taskPageSize)}
          >
            {api.t('runtime.next')}
          </Button>
        </Toolbar>
      </Show>
    </>
  )
}
