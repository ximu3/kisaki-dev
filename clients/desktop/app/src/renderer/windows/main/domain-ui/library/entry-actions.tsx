import { createSignal, Show } from 'solid-js'
import { MenuItem, MenuSeparator } from '@kisaki3/desktop-ui/menu'
import {
  parseEntryMergeInput,
  parseEntryUpdate,
  type EntryRef,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../infrastructure/api'
import { createConfirmation } from '../../../../infrastructure/dialogs/confirmation'
import { reportError } from '../../../../infrastructure/notifications'
import { EntryPicker } from './picker'

export function createEntryActions(
  api: MainClient,
  selection: () => readonly EntryRef[],
  finish: (target?: EntryRef) => void,
) {
  const t = api.t,
    confirmation = createConfirmation(t)
  const [merging, setMerging] = createSignal<readonly EntryRef[]>()
  const sameType = () => new Set(selection().map((row) => row.type)).size === 1
  async function remove() {
    const selected = [...selection()]
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
  async function favorite(value: boolean) {
    const [first, ...rest] = selection().map((ref) =>
      parseEntryUpdate({ ref, changes: { evaluation: { favorite: value } } }),
    )
    if (first) {
      await api.call('library.entries.updateMany', [first, ...rest])
    }
  }
  function Items() {
    return (
      <>
        <MenuItem onSelect={() => void favorite(true).catch(reportError)}>
          {t('library.entryActions.favorite')}
        </MenuItem>
        <MenuItem onSelect={() => void favorite(false).catch(reportError)}>
          {t('library.entryActions.unfavorite')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem disabled={!sameType()} onSelect={() => setMerging([...selection()])}>
          {t('library.entryActions.merge')}
        </MenuItem>
        <MenuItem onSelect={() => void remove().catch(reportError)}>{t('actions.delete')}</MenuItem>
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
        <confirmation.Content />
      </>
    )
  }
  return { Items, Dialogs }
}
