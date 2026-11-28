import type { EntryRef } from '@kisaki3/desktop-contracts/library'
import { isWorkType } from '@kisaki3/desktop-contracts/library'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Tab, TabList, TabPanel, Tabs } from '@kisaki3/desktop-ui/tabs'
import {
  mdiAccountCircleOutline,
  mdiBookmarkOutline,
  mdiBookshelf,
  mdiClockOutline,
  mdiCogOutline,
  mdiGhostOutline,
  mdiInformationOutline,
  mdiLinkVariant,
  mdiNoteTextOutline,
  mdiOfficeBuildingOutline,
  mdiPlaylistPlay,
} from '@mdi/js'
import type { JSX } from '@solidjs/web'
import { createSignal, For, Show } from 'solid-js'
import type { EntryLocation } from '../../../../../../../shared/window-api/library'
import type { MainClient } from '../../../../../../infrastructure/api'
import {
  observeDialogTarget,
  type DialogReceipt,
} from '../../../../../../infrastructure/dialogs/presentation'
import { errorMessage } from '../../../../../../infrastructure/notifications'
import { LaunchConfigs } from '../../holdings/game/launch-configs'
import { WorkParts } from '../../parts'
import { libraryRead } from '../../read'
import { Activities } from '../../records/activities'
import { Annotations } from '../../records/annotations'
import { Notes } from '../../records/notes'
import { RelationSection } from '../../relations/section'
import { relationTabs } from '../../relations/views'
import { createDetailControls } from './controls'
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

export interface EntryDetailsProps {
  api: MainClient
  target: EntryRef
  receipt?: DialogReceipt | undefined
  initialTab?: string | undefined
  tabChanged?: (tab: string) => void
  location?: EntryLocation
  openOrganizer: (kind: 'tag' | 'collection', id: string, name: string) => void
  open: (ref: EntryRef) => void
}

export interface DetailLayout {
  title: string
  status: JSX.Element
  actions: JSX.Element
  content: JSX.Element
}

export function EntryDetails(
  props: EntryDetailsProps & { layout: (view: DetailLayout) => JSX.Element },
) {
  const { api } = props,
    t = api.t
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
    props.tabChanged?.(value)
    selectTab(value)
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
  function panel(tab: EntryPanel) {
    const entry = props.target
    if (tab === 'notes') {
      return <Notes api={api} entry={entry} openEntry={props.open} />
    }
    if (!isWorkType(entry.type)) {
      return null
    }
    const work = { type: entry.type, id: entry.id }
    switch (tab) {
      case 'configs':
        return (
          work.type === 'game' && (
            <LaunchConfigs
              api={api}
              game={work.id}
              {...(props.location?.config && { initial: props.location.config })}
            />
          )
        )
      case 'parts':
        return (
          work.type !== 'game' && (
            <WorkParts
              api={api}
              work={{ type: work.type, id: work.id }}
              {...(props.location && { location: props.location })}
            />
          )
        )
      case 'activity':
        return (
          <Activities api={api} query={{ scope: { type: 'works', refs: [work] } }} work={work} />
        )
      case 'annotations':
        return <Annotations api={api} scope={{ type: 'work', work }} />
    }
  }

  const controls = createDetailControls(props, () => result.result()?.value)
  function content() {
    return (
      <>
        <Show when={result.result()?.error}>
          {(cause) => <p role="alert">{errorMessage(cause())}</p>}
        </Show>
        <Show when={result.result()?.value === null}>
          <p class="p-4 text-sm">{t('library.noMatch')}</p>
        </Show>
        <Show when={result.result()?.value}>
          {(saved) => (
            <>
              <EntryHero
                api={api}
                entry={saved().entry}
                edit={controls.editField}
                activity={() => setTab('activity')}
                status={controls.openStatus}
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
                  class="w-full justify-start overflow-x-auto [scrollbar-width:none]"
                  aria-label={saved().entry.name}
                >
                  <For each={tabs()}>
                    {(key) => (
                      <Tab
                        value={key}
                        class="gap-1.5"
                        aria-label={tabLabel(key)}
                        title={tabLabel(key)}
                      >
                        <Icon path={icons[key]} class="size-3.5" />
                        <span class="@max-2xl:hidden">{tabLabel(key)}</span>
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
                      edit={controls.editField}
                      open={props.open}
                      spoilers={controls.spoilers()}
                      tab={setTab}
                    />
                  </Show>
                </TabPanel>
                <For
                  each={tabs().filter(
                    (key): key is EntryPanel =>
                      key === 'configs' ||
                      key === 'parts' ||
                      key === 'activity' ||
                      key === 'annotations' ||
                      key === 'notes',
                  )}
                >
                  {(key) => (
                    <TabPanel value={key} class="pt-4">
                      <Show when={tab() === key}>{panel(key)}</Show>
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
                          spoilers={controls.spoilers()}
                          open={props.open}
                          all={() => setTab(key)}
                        />
                      </Show>
                    </TabPanel>
                  )}
                </For>
              </Tabs>
            </>
          )}
        </Show>
      </>
    )
  }
  return (
    <>
      {props.layout({
        get title() {
          return result.result()?.value?.entry.name ?? t('library.pages.library')
        },
        get status() {
          return controls.status()
        },
        get actions() {
          return controls.toolbar()
        },
        get content() {
          return content()
        },
      })}
      <controls.dialogs />
    </>
  )
}
