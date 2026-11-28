import { createSignal, For, Show, type ParentProps } from 'solid-js'
import {
  ContextMenuTrigger,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSubTrigger,
} from '@kisaki3/desktop-ui/menu'
import {
  isWorkType,
  type WorkRef,
  type WorkType,
  type EntryChanges,
  type WorkStatus,
  parseEntryMergeInput,
  parseEntryUpdate,
  type EntryRef,
} from '@kisaki3/desktop-contracts/library'
import { Icon } from '@kisaki3/desktop-ui/icon'
import {
  mdiDeleteOutline,
  mdiFolderPlusOutline,
  mdiFolderRemoveOutline,
  mdiHeartOutline,
  mdiHeartOffOutline,
  mdiTagPlusOutline,
  mdiTagMinusOutline,
  mdiPlaylistCheck,
} from '@mdi/js'
import type { MainClient } from '../../../../../infrastructure/api'
import { createConfirmation } from '../../../../../infrastructure/dialogs/confirmation'
import { reportError } from '../../../../../infrastructure/notifications'
import { EntryPicker } from '../picker'
import { CompletionEditor, type CompletionEdit } from '../completions/editor'
import { MembershipEditor, membershipLabels, type MembershipEdit } from './membership'

const membershipIcons = {
  collection: { add: mdiFolderPlusOutline, remove: mdiFolderRemoveOutline },
  tag: { add: mdiTagPlusOutline, remove: mdiTagMinusOutline },
}

export function createEntryActions(
  api: MainClient,
  selection: () => readonly EntryRef[],
  finish: (target?: EntryRef) => void,
) {
  const t = api.t,
    confirmation = createConfirmation(t)
  const [merging, setMerging] = createSignal<readonly EntryRef[]>()
  const [targets, setTargets] = createSignal<readonly EntryRef[]>([])
  const [membership, setMembership] = createSignal<MembershipEdit>()
  const [completion, setCompletion] = createSignal<CompletionEdit>()
  function capture(refs = selection()) {
    setTargets([...refs])
  }
  function openMenu(open: boolean) {
    if (open) {
      capture()
    }
  }
  const sameType = () => new Set(targets().map((row) => row.type)).size === 1
  function works() {
    const entries = targets()
    return entries.every((ref): ref is WorkRef => isWorkType(ref.type)) ? entries : []
  }
  function record(mode: 'current' | 'past') {
    const [work, ...additionalWorks] = works()
    if (work) {
      setCompletion({ mode, work, additionalWorks })
    }
  }
  async function update(
    changes: Pick<EntryChanges<WorkType>, 'evaluation' | 'record'>,
    entries: readonly EntryRef[],
  ) {
    const [first, ...rest] = entries.map((ref) => parseEntryUpdate({ ref, changes }))
    if (first) {
      await api.call('library.entries.updateMany', [first, ...rest])
    }
  }
  function status(value: WorkStatus | null) {
    void update({ record: { status: value } }, works()).catch(reportError)
  }
  function RowMenu(
    props: ParentProps<{ class?: string; prepare: (event: MouseEvent | KeyboardEvent) => void }>,
  ) {
    const [shown, setShown] = createSignal(false)
    return (
      <Menu onOpenChange={setShown}>
        <ContextMenuTrigger
          class={props.class}
          tabindex={-1}
          onContextMenu={props.prepare}
          onKeyDown={(event) => {
            if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
              props.prepare(event)
            }
          }}
        >
          {props.children}
        </ContextMenuTrigger>
        <MenuContent>
          <Show when={shown()}>
            <Items />
          </Show>
        </MenuContent>
      </Menu>
    )
  }

  async function remove() {
    const selected = targets()
    if (
      selected.length &&
      (await confirmation.ask(
        t('library.entryActions.remove'),
        t('actions.delete'),
        t('library.selection', { count: selected.length }) +
          ' · ' +
          t('library.entryActions.removeDetail'),
      ))
    ) {
      await api.call('library.delete', selected)
      finish()
    }
  }
  async function merge(target: EntryRef) {
    const sources = (merging() ?? []).filter((row) => row.id !== target.id)
    if (!sources.length) {
      return
    }
    const input = parseEntryMergeInput({ sources, target })
    if (
      await confirmation.ask(
        t('library.entryActions.merge'),
        t('actions.confirm'),
        t('library.entryActions.mergeDetail'),
      )
    ) {
      const kept = await api.call('library.merge', input)
      finish(kept)
    }
  }
  function favorite(value: boolean) {
    void update({ evaluation: { favorite: value } }, targets()).catch(reportError)
  }
  function Items() {
    return (
      <>
        <div class="px-2 py-1 text-xs text-muted-foreground">
          {t('library.selection', { count: targets().length })}
        </div>
        <MenuSeparator />
        <For each={['collection', 'tag'] as const}>
          {(kind) => (
            <For each={['add', 'remove'] as const}>
              {(operation) => (
                <MenuItem
                  icon={<Icon path={membershipIcons[kind][operation]} />}
                  onSelect={() => setMembership({ kind, operation, entries: targets() })}
                >
                  {t(membershipLabels[kind][operation])}
                </MenuItem>
              )}
            </For>
          )}
        </For>
        <MenuSeparator />
        <MenuItem icon={<Icon path={mdiHeartOutline} />} onSelect={() => favorite(true)}>
          {t('library.entryActions.favorite')}
        </MenuItem>
        <MenuItem icon={<Icon path={mdiHeartOffOutline} />} onSelect={() => favorite(false)}>
          {t('library.entryActions.unfavorite')}
        </MenuItem>
        <MenuSeparator />
        <Menu>
          <MenuSubTrigger disabled={!works().length} icon={<Icon path={mdiPlaylistCheck} />}>
            {t('library.detail.setStatus')}
          </MenuSubTrigger>
          <MenuContent>
            <For each={['planned', 'active', 'onHold', null] as const}>
              {(value) => (
                <MenuItem onSelect={() => status(value)}>
                  {t(`library.status.${value ?? 'unset'}`)}
                </MenuItem>
              )}
            </For>
            <MenuSeparator />
            <MenuItem onSelect={() => record('current')}>
              {t('library.detail.recordCurrent')}
            </MenuItem>
            <MenuItem onSelect={() => record('past')}>{t('library.detail.addCompletion')}</MenuItem>
          </MenuContent>
        </Menu>
        <MenuSeparator />
        <MenuItem disabled={!sameType()} onSelect={() => setMerging(targets())}>
          {t('library.entryActions.merge')}
        </MenuItem>
        <MenuItem
          destructive
          icon={<Icon path={mdiDeleteOutline} />}
          onSelect={() => void remove().catch(reportError)}
        >
          {t('actions.delete')}
        </MenuItem>
      </>
    )
  }
  function Dialogs() {
    return (
      <>
        <Show when={merging()}>
          {(rows) => (
            <EntryPicker
              api={api}
              title={t('library.entryActions.survivor')}
              types={[rows()[0]!.type]}
              close={() => setMerging(undefined)}
              choose={(refs) => {
                if (refs[0]) {
                  void merge(refs[0]).catch(reportError)
                }
              }}
            />
          )}
        </Show>
        <MembershipEditor api={api} edit={membership()} close={() => setMembership(undefined)} />
        <CompletionEditor api={api} edit={completion()} close={() => setCompletion(undefined)} />
        <confirmation.Content />
      </>
    )
  }
  return { Items, Dialogs, RowMenu, capture, openMenu }
}
