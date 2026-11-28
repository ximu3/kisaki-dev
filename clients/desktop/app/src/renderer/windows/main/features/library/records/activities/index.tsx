import { createSignal, For, Show } from 'solid-js'
import { mdiClockOutline, mdiPencilOutline, mdiTrashCanOutline, mdiPlus } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Button } from '@kisaki3/desktop-ui/button'
import type { Activity, ActivityQuery, WorkRef } from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../../infrastructure/api'
import { createConfirmation } from '../../../../../../infrastructure/dialogs/confirmation'
import { EditorDialog } from '../../../../../../infrastructure/dialogs/editor'
import { errorMessage, reportError } from '../../../../../../infrastructure/notifications'
import { libraryRead } from '../../../../domain-ui/library/read'
import { ActivityEditor, type ActivityEdit } from './editor'

export function Activities(props: {
  api: MainClient
  query: ActivityQuery
  work?: WorkRef
  openWork?: (work: WorkRef) => void
}) {
  const { api } = props,
    t = api.t,
    confirm = createConfirmation(t)
  const [offset, setOffset] = createSignal(0),
    [edit, setEdit] = createSignal<ActivityEdit>()
  const items = libraryRead(api, ['activities'], (signal) =>
    api.request(signal, 'library.activities.list', props.query, { offset: offset(), limit: 50 }),
  )
  const names = libraryRead(api, ['entries', 'activities'], async (signal) => {
    const refs = [
      ...new Map(
        (items.result()?.value?.items ?? []).map((row) => [row.work.id, row.work]),
      ).values(),
    ]
    return await api.request(signal, 'library.entries.resolveRefs', refs)
  })
  const format = () =>
    new Intl.DateTimeFormat(api.locale(), { dateStyle: 'medium', timeStyle: 'short' })
  async function remove(row: Activity) {
    if (
      await confirm.ask(
        t('library.records.removeActivity'),
        t('actions.delete'),
        format().format(row.startedAt),
      )
    ) {
      await api.call('library.activities.delete', row.work, [row.id])
    }
  }
  return (
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold">{t('library.records.activity')}</h3>
        <Show when={props.work}>
          {(work) => (
            <Button size="sm" variant="outline" onClick={() => setEdit({ work: work() })}>
              <Icon path={mdiPlus} />
              {t('library.records.addActivity')}
            </Button>
          )}
        </Show>
      </div>
      <Show when={items.result()?.error}>{(e) => <p role="alert">{errorMessage(e())}</p>}</Show>
      <Show when={items.result()?.value}>
        {(page) => (
          <>
            <Show
              when={page().items.length}
              fallback={
                <div class="grid justify-items-center gap-3 py-12 text-muted-foreground">
                  <Icon path={mdiClockOutline} class="size-8" />
                  {t('library.detail.noRecords')}
                </div>
              }
            >
              <div class="divide-y overflow-hidden rounded-md border">
                <For each={page().items}>
                  {(row) => (
                    <div class="flex items-center justify-between gap-3 px-3 py-2.5">
                      <Icon path={mdiClockOutline} class="size-4 text-muted-foreground" />
                      <div class="min-w-0 grow">
                        <p class="truncate text-sm font-medium">
                          {format().format(row.startedAt)} – {format().format(row.endedAt)}
                        </p>
                        <p class="text-xs text-muted-foreground">
                          {new Intl.NumberFormat(api.locale(), {
                            maximumFractionDigits: 2,
                            style: 'unit',
                            unit: 'minute',
                          }).format(row.durationMs / 60000)}{' '}
                          ·{' '}
                          {Object.values(row.contextNames).join(' · ') ||
                            names.result()?.value?.find((e) => e.id === row.work.id)?.name}
                        </p>
                      </div>
                      <Show when={props.openWork}>
                        {(open) => (
                          <Button size="sm" variant="ghost" onClick={() => open()(row.work)}>
                            {t('actions.open')}
                          </Button>
                        )}
                      </Show>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('actions.edit')}
                        onClick={() => setEdit({ work: row.work, saved: row })}
                      >
                        <Icon path={mdiPencilOutline} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('actions.delete')}
                        onClick={() => void remove(row).catch(reportError)}
                      >
                        <Icon path={mdiTrashCanOutline} />
                      </Button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <Show when={page().total > 50}>
              <div class="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!offset()}
                  onClick={() => setOffset((v) => v - 50)}
                >
                  {t('actions.previous')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={offset() + 50 >= page().total}
                  onClick={() => setOffset((v) => v + 50)}
                >
                  {t('actions.next')}
                </Button>
              </div>
            </Show>
          </>
        )}
      </Show>
      <EditorDialog edit={edit()} size="md" onClose={() => setEdit(undefined)}>
        {(value, guard) => (
          <ActivityEditor
            api={api}
            edit={value}
            close={guard.requestClose}
            saved={() => setEdit(undefined)}
            register={guard.registerEditor}
          />
        )}
      </EditorDialog>
      <confirm.Content />
    </section>
  )
}
