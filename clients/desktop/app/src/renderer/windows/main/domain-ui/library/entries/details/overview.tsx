import type { PartialDate } from '@kisaki3/desktop-contracts/date'
import type { EntryDetails, EntryRef } from '@kisaki3/desktop-contracts/library'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { mdiOpenInNew } from '@mdi/js'
import { For, Show } from 'solid-js'
import type { MainClient } from '../../../../../../infrastructure/api'
import { reportError } from '../../../../../../infrastructure/notifications'
import { FieldSection } from '../../fields/section'
import { SavedMarkdown } from '../../images/markdown'
import { RelationSection } from '../../relations/section'
import { relationTabs, type RelationTab } from '../../relations/views'
import type { EditField } from '../editor/model'
import { calendarText, countFields, detailDates, measurements, measureText } from '../fields'
import { EntryOrganizers } from './organizers'

export function EntryOverview(props: {
  api: MainClient
  entry: EntryDetails
  description: string | null
  spoilers: boolean
  edit: (scope: EditField) => void
  openOrganizer: (kind: 'tag' | 'collection', id: string, name: string) => void
  open: (entry: EntryRef) => void
  tab: (tab: RelationTab) => void
}) {
  const { api } = props,
    t = api.t
  const ref = () => ({ type: props.entry.type, id: props.entry.id })
  function related(tab: RelationTab, mode: 'cards' | 'links') {
    return (
      <RelationSection
        api={api}
        owner={ref()}
        tab={tab}
        mode={mode}
        spoilers={props.spoilers}
        open={props.open}
        all={() => props.tab(tab)}
      />
    )
  }
  const rows = () => {
    const entry = props.entry
    const fields: { name: string; value: string }[] = [
      { name: t('library.fields.aliases'), value: entry.aliases.join('\n') || '—' },
    ]
    for (const key of countFields(entry.type)) {
      const value: unknown = Reflect.get(entry, key)
      fields.push({
        name: t(`library.fields.${key}`),
        value: typeof value === 'number' ? String(value) : '—',
      })
    }
    if ('gender' in entry && entry.gender) {
      fields.push({ name: t('library.fields.gender'), value: t(`library.values.${entry.gender}`) })
    }
    if (entry.type === 'character') {
      for (const key of measurements) {
        fields.push({ name: t(`library.fields.${key}`), value: measureText(entry[key]) })
      }
      fields.push({ name: t('library.fields.cupSize'), value: entry.cupSize ?? '—' })
    }
    for (const key of detailDates(entry.type)) {
      const date = Reflect.get(entry, key) as PartialDate | null
      const value =
        key === 'addedDate' && !date
          ? new Intl.DateTimeFormat(api.locale()).format(entry.createdAt)
          : calendarText(date, api.locale())
      fields.push({ name: t(`library.fields.${key}`), value })
    }
    return fields
  }
  const left = () =>
    relationTabs(ref()).filter(
      (tab) => tab === 'characters' || tab === 'related' || tab === 'works',
    )
  const right = () =>
    relationTabs(ref()).filter((tab) => tab === 'persons' || tab === 'organizations')
  return (
    <div class="grid gap-8 @min-[48rem]:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
      <div class="min-w-0 space-y-6">
        <FieldSection
          title={t('library.fields.description')}
          editLabel={t('actions.editItem', { name: t('library.fields.description') })}
          edit={() => props.edit('description')}
        >
          <Show
            when={props.description}
            fallback={
              <p class="text-xs text-muted-foreground italic">
                {t('library.detail.noDescription')}
              </p>
            }
          >
            {(value) => <SavedMarkdown api={api} value={value()} />}
          </Show>
        </FieldSection>
        <For each={left()}>{(tab) => related(tab, 'cards')}</For>
        <EntryOrganizers
          api={api}
          entry={ref()}
          spoilers={props.spoilers}
          open={props.openOrganizer}
        />
      </div>
      <div class="min-w-0 space-y-6">
        <FieldSection
          title={t('library.fields.information')}
          editLabel={t('actions.editItem', { name: t('library.fields.information') })}
          edit={() => props.edit('information')}
        >
          <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
            <For each={rows()}>
              {(row) => (
                <>
                  <dt class="text-muted-foreground">{row.name}</dt>
                  <dd class="whitespace-pre-line break-words">{row.value}</dd>
                </>
              )}
            </For>
          </dl>
        </FieldSection>
        <For each={right()}>{(tab) => related(tab, 'links')}</For>
        <FieldSection
          title={t('library.fields.links')}
          editLabel={t('actions.editItem', { name: t('library.fields.links') })}
          edit={() => props.edit('links')}
        >
          <For
            each={props.entry.externalLinks}
            fallback={
              <p class="text-xs text-muted-foreground italic">{t('library.detail.empty')}</p>
            }
          >
            {(link) => (
              <a
                class="flex items-center gap-1 text-xs text-primary hover:underline"
                href={link.url}
                onClick={(event) => {
                  event.preventDefault()
                  void api.call('library.openExternalLink', link.url).catch(reportError)
                }}
                target="_blank"
                rel="noreferrer"
              >
                <Icon path={mdiOpenInNew} class="size-3.5" />
                <span>{link.name}</span>
              </a>
            )}
          </For>
        </FieldSection>
      </div>
    </div>
  )
}
