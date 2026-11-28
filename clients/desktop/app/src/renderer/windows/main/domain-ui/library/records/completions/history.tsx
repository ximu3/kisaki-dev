import type { WorkCompletion, WorkRef } from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kisaki3/desktop-ui/dialog'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { mdiPencilOutline, mdiPlus, mdiTrashCanOutline } from '@mdi/js'
import { createSignal, For, Show } from 'solid-js'
import type { MainClient } from '../../../../../../infrastructure/api'
import { createConfirmation } from '../../../../../../infrastructure/dialogs/confirmation'
import { errorMessage, reportError } from '../../../../../../infrastructure/notifications'
import { calendarText } from '../../entries/fields'
import { libraryRead } from '../../read'
import type { CompletionEdit } from './editor'

export function CompletionHistory(props: {
  api: MainClient
  work: WorkRef
  close: () => void
  edit: (edit: CompletionEdit) => void
}) {
  const { api } = props,
    t = api.t
  const [offset, setOffset] = createSignal(0)
  const list = libraryRead(api, ['entries', 'activities'], async (signal) => {
    const start = offset()
    const result = await api.request(signal, 'library.completions.list', props.work, {
      offset: start,
      limit: 50,
    })
    if (start > 0 && start >= result.total) {
      setOffset(Math.max(0, start - 50))
    }
    return result
  })
  const confirm = createConfirmation(t)
  async function remove(row: WorkCompletion) {
    if (
      await confirm.ask(
        t('library.detail.removeCompletion'),
        t('actions.delete'),
        row.note ?? calendarText(row.completedDate, api.locale()),
      )
    ) {
      await api.call('library.completions.delete', props.work, row.id)
    }
  }
  return (
    <>
      <Dialog
        open
        onOpenChange={(v) => {
          if (!v) {
            props.close()
          }
        }}
      >
        <DialogContent size="md">
          <DialogHeader closeLabel={t('actions.close')}>
            <DialogTitle>{t('library.detail.history')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Show when={list.result()?.error}>
              {(e) => <p role="alert">{errorMessage(e())}</p>}
            </Show>
            <Show when={list.result()?.value}>
              {(page) => (
                <Show
                  when={page().total}
                  fallback={
                    <p class="p-6 text-center text-sm text-muted-foreground">
                      {t('library.detail.noRecords')}
                    </p>
                  }
                >
                  <table class="w-full text-start text-sm">
                    <thead>
                      <tr>
                        <th class="text-start">{t('library.fields.completedDate')}</th>
                        <th class="text-start">{t('library.fields.note')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      <For each={page().items} keyed={(row) => row.id}>
                        {(row) => (
                          <tr class="border-t border-border">
                            <td>
                              {row().completedDate
                                ? calendarText(row().completedDate, api.locale())
                                : t('library.completion.unknownDate')}
                            </td>
                            <td class="whitespace-pre-wrap py-2">{row().note}</td>
                            <td class="text-end">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('actions.edit')}
                                onClick={() =>
                                  props.edit({ mode: 'edit', work: props.work, record: row() })
                                }
                              >
                                <Icon path={mdiPencilOutline} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('actions.delete')}
                                onClick={() => void remove(row()).catch(reportError)}
                              >
                                <Icon path={mdiTrashCanOutline} />
                              </Button>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                  <Show when={page().total > 50}>
                    <div class="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!offset()}
                        onClick={() => setOffset((n) => n - 50)}
                      >
                        {t('actions.previous')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={offset() + 50 >= page().total}
                        onClick={() => setOffset((n) => n + 50)}
                      >
                        {t('actions.next')}
                      </Button>
                    </div>
                  </Show>
                </Show>
              )}
            </Show>
          </DialogBody>
          <DialogFooter>
            <Button
              class="me-auto"
              size="sm"
              variant="outline"
              onClick={() => props.edit({ mode: 'past', work: props.work })}
            >
              <Icon path={mdiPlus} />
              {t('library.detail.addCompletion')}
            </Button>
            <Button variant="outline" onClick={props.close}>
              {t('actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <confirm.Content />
    </>
  )
}
