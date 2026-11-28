import { createSignal, For, Show } from 'solid-js'
import type { JSX } from '@solidjs/web'
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
import { Tabs, TabList, Tab, TabPanel } from '@kisaki3/desktop-ui/tabs'
import {
  mdiCogOutline,
  mdiPlaylistPlay,
  mdiBookmarkOutline,
  mdiClockOutline,
  mdiNoteTextOutline,
  mdiInformationOutline,
  mdiGhostOutline,
  mdiAccountCircleOutline,
  mdiOfficeBuildingOutline,
  mdiLinkVariant,
  mdiBookshelf,
  mdiDotsHorizontal,
  mdiEyeOutline,
  mdiEyeOffOutline,
  mdiHeart,
  mdiHeartOutline,
} from '@mdi/js'
import type { EntryRef, WorkRef } from '@kisaki3/desktop-contracts/library'
import type { EntryLocation } from '../../../../../../../shared/window-api/library'
import type { MainClient } from '../../../../../../infrastructure/api'
import { errorMessage, reportError } from '../../../../../../infrastructure/notifications'
import { libraryRead } from '../../read'
import { PageBar } from '../../chrome'
import { catalogIcon } from '../../icons'
import { EntryEditorDialog } from '../editor'
import type { EntryEdit, EditField } from '../editor/model'
import {
  observeDialogTarget,
  type DialogReceipt,
} from '../../../../../../infrastructure/dialogs/presentation'
import { createEntryActions } from '../actions'
import { relationTabs } from '../../relations/views'
import { RelationSection } from '../../relations/section'
import { CompletionHistory } from '../../completions/history'
import { CompletionEditor, type CompletionEdit } from '../../completions/editor'
import { EntryHero } from './hero'
import { EntryOverview } from './overview'

const icons = {
  annotations: mdiBookmarkOutline,
  configs: mdiCogOutline,
  parts: mdiPlaylistPlay,
  activity: mdiClockOutline,
  notes: mdiNoteTextOutline,
  overview: mdiInformationOutline,
  characters: mdiGhostOutline,
  persons: mdiAccountCircleOutline,
  organizations: mdiOfficeBuildingOutline,
  related: mdiLinkVariant,
  works: mdiBookshelf,
}
export type EntryPanel = 'configs' | 'parts' | 'activity' | 'annotations' | 'notes'

export function EntryDetails(props: {
  api: MainClient
  target: EntryRef
  receipt?: DialogReceipt | undefined
  initialTab?: string | undefined
  tabChanged: (tab: string) => void
  workActions: (work: WorkRef) => JSX.Element
  panel: (tab: EntryPanel) => JSX.Element
  location?: EntryLocation
  openOrganizer: (kind: 'tag' | 'collection', id: string, name: string) => void
  open: (ref: EntryRef) => void
}) {
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
  const result = libraryRead(api, ['entries'], async (signal) => {
    const [entry, description] = await Promise.all([
      api.request(signal, 'library.entries.get', props.target),
      api.request(signal, 'library.entries.getDescription', props.target),
    ])
    return entry ? { entry, description } : null
  })
  observeDialogTarget(props.receipt, () => {
    const read = result.result()
    return {
      presented: !!read?.value,
      error: read?.error ?? (read?.value === null ? new Error(t('library.noMatch')) : undefined),
    }
  })
  const record = () => {
    const item = result.result()?.value?.entry
    return item && 'record' in item ? item : undefined
  }
  const work = () => {
    const item = record()
    return item ? { type: item.type, id: item.id } : undefined
  }
  type DetailTab = keyof typeof icons
  function initialTab(): DetailTab {
    if (props.initialTab && Object.hasOwn(icons, props.initialTab)) {
      return props.initialTab as DetailTab
    }
    if (props.location?.config) {
      return 'configs'
    }
    if (props.location?.file || props.location?.parts.length) {
      return 'parts'
    }
    return 'overview'
  }
  const [tab, selectTab] = createSignal<DetailTab>(initialTab())
  function setTab(value: DetailTab) {
    props.tabChanged(value)
    selectTab(value)
  }
  const [edit, setEdit] = createSignal<EntryEdit>()
  const [spoilers, setSpoilers] = createSignal(false)
  const [history, setHistory] = createSignal(false)
  const [completion, setCompletion] = createSignal<CompletionEdit>()
  let statusButton: HTMLButtonElement | undefined
  function editField(field: EditField) {
    const data = result.result()?.value
    if (data) {
      setEdit({ field, entry: data.entry, description: data.description })
    }
  }
  function tabs(): DetailTab[] {
    const values: DetailTab[] = ['overview', ...relationTabs(props.target)]
    const ref = work()
    if (ref) {
      values.push(ref.type === 'game' ? 'configs' : 'parts', 'activity', 'annotations')
    }
    values.push('notes')
    return values
  }
  function tabLabel(key: DetailTab) {
    if (key === 'notes' || key === 'annotations') {
      return t(`library.pages.${key}`)
    }
    if (key === 'configs') {
      return t('library.holdings.configs')
    }
    if (key === 'parts') {
      if (props.target.type === 'anime') {
        return t('library.detail.episodes')
      }
      if (props.target.type === 'comic') {
        return t('library.detail.chapters')
      }
      return t('library.detail.volumes')
    }
    return t(`library.detail.${key}`)
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
  return (
    <article class="flex h-full min-h-0 flex-col bg-background">
      <Show when={result.result()?.error}>
        {(cause) => <p role="alert">{errorMessage(cause())}</p>}
      </Show>
      <Show when={result.result()?.value === null}>
        <p class="p-4 text-sm">{t('library.noMatch')}</p>
      </Show>
      <Show when={result.result()?.value}>
        {(saved) => (
          <>
            <PageBar
              title={saved().entry.name}
              icon={catalogIcon[props.target.type]}
              afterTitle={statusControl()}
            >
              <Show when={work()}>{(ref) => props.workActions(ref())}</Show>
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
            </PageBar>
            <div class="@container min-h-0 grow overflow-y-auto p-4">
              <EntryHero
                api={api}
                entry={saved().entry}
                edit={editField}
                activity={() => setTab('activity')}
                status={() => statusButton?.click()}
              />
              <Tabs
                value={tab()}
                onValueChange={(v) => {
                  const next = tabs().find((key) => key === v)
                  if (next) {
                    setTab(next)
                  }
                }}
              >
                <TabList
                  class="w-full justify-start overflow-x-auto"
                  aria-label={saved().entry.name}
                >
                  <For each={tabs()}>
                    {(key) => (
                      <Tab value={key}>
                        <Icon path={icons[key]} class="size-3.5" />
                        {tabLabel(key)}
                      </Tab>
                    )}
                  </For>
                </TabList>
                <TabPanel value="overview" class="pt-4">
                  <Show when={tab() === 'overview'}>
                    <EntryOverview
                      openOrganizer={props.openOrganizer}
                      api={api}
                      entry={saved().entry}
                      description={saved().description}
                      edit={editField}
                      open={props.open}
                      spoilers={spoilers()}
                      tab={setTab}
                    />
                  </Show>
                </TabPanel>
                <For each={['configs', 'parts', 'activity', 'annotations', 'notes'] as const}>
                  {(key) => (
                    <TabPanel value={key} class="pt-4">
                      <Show when={tab() === key}>{props.panel(key)}</Show>
                    </TabPanel>
                  )}
                </For>
                <For each={relationTabs(props.target)}>
                  {(key) => (
                    <TabPanel value={key} class="pt-4">
                      <Show when={tab() === key}>
                        <RelationSection
                          api={api}
                          owner={props.target}
                          tab={key}
                          mode="list"
                          spoilers={spoilers()}
                          open={props.open}
                          all={() => setTab(key)}
                        />
                      </Show>
                    </TabPanel>
                  )}
                </For>
              </Tabs>
            </div>
          </>
        )}
      </Show>
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
    </article>
  )
}
