import type { EntryRef, EntryDetails as SavedEntry } from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '@kisaki3/desktop-ui/menu'
import {
  mdiDotsHorizontal,
  mdiEyeOffOutline,
  mdiEyeOutline,
  mdiHeart,
  mdiHeartOutline,
} from '@mdi/js'
import { createSignal, For, Show } from 'solid-js'
import type { MainClient } from '../../../../../../infrastructure/api'
import { reportError } from '../../../../../../infrastructure/notifications'
import { DirectoryMenu } from '../../holdings/directories/menu'
import { CompletionEditor, type CompletionEdit } from '../../records/completions/editor'
import { CompletionHistory } from '../../records/completions/history'
import { createEntryActions } from '../actions'
import { EntryEditorDialog } from '../editor'
import type { EditField, EntryEdit } from '../editor/model'

export function createDetailControls(
  props: { api: MainClient; target: EntryRef; open: (ref: EntryRef) => void },
  data: () => { entry: SavedEntry; description: string | null } | null | undefined,
) {
  const { api } = props,
    t = api.t
  const actions = createEntryActions(
    api,
    () => [props.target],
    (ref) => {
      if (ref) {
        props.open(ref)
      }
    },
  )
  const record = () => {
    const item = data()?.entry
    return item && 'record' in item ? item : undefined
  }
  const work = () => {
    const item = record()
    return item ? { type: item.type, id: item.id } : undefined
  }
  const [edit, setEdit] = createSignal<EntryEdit>()
  const [spoilers, setSpoilers] = createSignal(false)
  const [history, setHistory] = createSignal(false)
  const [completion, setCompletion] = createSignal<CompletionEdit>()
  let statusButton: HTMLButtonElement | undefined
  function editField(field: EditField) {
    const saved = data()
    if (saved) {
      setEdit({ field, entry: saved.entry, description: saved.description })
    }
  }
  function statusLabel() {
    const entry = record()
    if (!entry) {
      return ''
    }
    const values: string[] = []
    if (entry.record.status) {
      values.push(t(`library.workStatus.${entry.type}.${entry.record.status}`))
    }
    if (entry.completionCount > 0) {
      values.push(t('library.detail.completed', { count: entry.completionCount }))
    }
    return values.join(' · ') || t('library.detail.setStatus')
  }
  async function status(value: 'active' | 'planned' | 'onHold' | null) {
    const saved = record(),
      ref = work()
    if (saved && ref) {
      await api.call('library.entries.setWorkStatus', ref, {
        status: value,
        expected: { status: saved.record.status },
      })
    }
  }
  function statusControl() {
    return (
      <Show when={record()}>
        {(saved) => (
          <Menu>
            <MenuTrigger
              ref={(node) => {
                statusButton = node
              }}
              variant="secondary"
              size="sm"
              class="h-5 px-1.5 text-xs"
              aria-label={t('library.detail.setStatus')}
            >
              {statusLabel()}
            </MenuTrigger>
            <MenuContent placement="bottom-start">
              <For each={['planned', 'active', 'onHold'] as const}>
                {(value) => (
                  <MenuRadioItem
                    value={value}
                    selectedValue={saved().record.status ?? ''}
                    onValueChange={() => void status(value).catch(reportError)}
                  >
                    {t(`library.workStatus.${saved().type}.${value}`)}
                  </MenuRadioItem>
                )}
              </For>
              <MenuItem onSelect={() => void status(null).catch(reportError)}>
                {t('actions.clear')}
              </MenuItem>
              <MenuSeparator />
              <MenuItem onSelect={() => setCompletion({ mode: 'current', work: work()! })}>
                {t('library.detail.recordCurrent')}
              </MenuItem>
              <MenuItem onSelect={() => setHistory(true)}>{t('library.detail.history')}</MenuItem>
            </MenuContent>
          </Menu>
        )}
      </Show>
    )
  }
  function toolbar() {
    return (
      <Show when={data()}>
        {(saved) => (
          <>
            <Show when={work()}>{(ref) => <DirectoryMenu api={api} work={ref()} />}</Show>
            <Button
              size="icon-sm"
              variant="secondary"
              aria-label={t('library.fields.favorite')}
              aria-pressed={saved().entry.evaluation.favorite ? 'true' : 'false'}
              onClick={() => {
                const before = saved().entry.evaluation.favorite
                void api
                  .call('library.entries.setEvaluation', props.target, {
                    changes: { favorite: !before },
                    expected: { favorite: before },
                  })
                  .catch(reportError)
              }}
            >
              <Icon
                path={saved().entry.evaluation.favorite ? mdiHeart : mdiHeartOutline}
                class={saved().entry.evaluation.favorite ? 'size-4 text-destructive' : 'size-4'}
              />
            </Button>
            <Button
              size="icon-sm"
              variant="secondary"
              aria-label={t('library.relation.showSpoilers')}
              aria-pressed={spoilers() ? 'true' : 'false'}
              onClick={() => setSpoilers((v) => !v)}
            >
              <Icon path={spoilers() ? mdiEyeOutline : mdiEyeOffOutline} />
            </Button>
            <Menu onOpenChange={actions.openMenu}>
              <MenuTrigger size="icon-sm" variant="secondary" aria-label={t('actions.more')}>
                <Icon path={mdiDotsHorizontal} />
              </MenuTrigger>
              <MenuContent placement="bottom-end">
                <MenuItem onSelect={() => editField('images')}>
                  {t('library.fields.primaryImageId')}
                </MenuItem>
                <MenuItem onSelect={() => editField('identities')}>
                  {t('library.fields.id')}
                </MenuItem>
                <MenuItem
                  onSelect={() =>
                    void api.call('library.entries.copyLink', props.target).catch(reportError)
                  }
                >
                  {t('library.detail.copyLink')}
                </MenuItem>
                <MenuSeparator />
                <actions.Items />
              </MenuContent>
            </Menu>
          </>
        )}
      </Show>
    )
  }
  function dialogs() {
    return (
      <>
        <actions.Dialogs />
        <EntryEditorDialog
          api={api}
          edit={edit()}
          close={() => setEdit(undefined)}
          saved={() => setEdit(undefined)}
        />
        <Show when={history() && work()}>
          {(ref) => (
            <CompletionHistory
              api={api}
              work={ref()}
              close={() => setHistory(false)}
              edit={setCompletion}
            />
          )}
        </Show>
        <CompletionEditor api={api} edit={completion()} close={() => setCompletion(undefined)} />
      </>
    )
  }
  return {
    status: statusControl,
    toolbar,
    dialogs,
    editField,
    spoilers,
    openStatus: () => statusButton?.click(),
  }
}
