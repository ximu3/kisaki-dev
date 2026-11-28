import type { FileQuery, FileWorkType, WorkRef } from '@kisaki3/desktop-contracts/library'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Popover, PopoverContent, PopoverTrigger } from '@kisaki3/desktop-ui/popover'
import { Select } from '@kisaki3/desktop-ui/select'
import { mdiFilterOutline } from '@mdi/js'
import type { MainClient } from '../../../../../../infrastructure/api'
import { libraryRead } from '../../read'

export type FileFilters = Pick<
  FileQuery,
  'directoryId' | 'association' | 'associationMode' | 'availability'
>

export function FilterFiles(props: {
  api: MainClient
  work: WorkRef<FileWorkType>
  value: FileFilters
  change: (v: FileFilters) => void
}) {
  const { api, work } = props,
    t = api.t
  const dirs = libraryRead(api, ['holdings'], (signal) =>
    api.request(signal, 'library.holdings.directories', work),
  )
  const common = {
      emptyMessage: t('controls.search.empty'),
      invalidSelectionMessage: t('controls.feedback.unavailable'),
    },
    all = { value: '', label: t('library.fileFilter.all') }
  function set(key: keyof FileFilters, value: string) {
    const next = { ...props.value }
    if (value) {
      Object.assign(next, { [key]: value })
    } else {
      delete next[key]
    }
    props.change(next)
  }
  return (
    <Popover>
      <PopoverTrigger size="icon-sm" variant="outline" aria-label={t('library.browse.filter')}>
        <Icon path={mdiFilterOutline} />
      </PopoverTrigger>
      <PopoverContent placement="bottom-end" class="w-72 space-y-2">
        <Field>
          <FieldLabel>{t('library.holdings.title')}</FieldLabel>
          <Select
            {...common}
            options={[
              all,
              ...(dirs.result()?.value ?? []).map((row) => ({ value: row.id, label: row.path })),
            ]}
            value={props.value.directoryId ?? ''}
            onValueChange={(v) => set('directoryId', v)}
          />
        </Field>
        <Field>
          <FieldLabel>{t('library.fileFilter.association')}</FieldLabel>
          <Select
            {...common}
            options={[
              all,
              { value: 'associated', label: t('library.fileFilter.linked') },
              { value: 'unassociated', label: t('library.fileFilter.unassociated') },
            ]}
            value={props.value.association ?? ''}
            onValueChange={(v) => set('association', v)}
          />
        </Field>
        <Field>
          <FieldLabel>{t('library.holdings.mode')}</FieldLabel>
          <Select
            {...common}
            options={[
              all,
              { value: 'automatic', label: t('library.holdings.automatic') },
              { value: 'manual', label: t('library.holdings.manual') },
            ]}
            value={props.value.associationMode ?? ''}
            onValueChange={(v) => set('associationMode', v)}
          />
        </Field>
        <Field>
          <FieldLabel>{t('library.holdings.available')}</FieldLabel>
          <Select
            {...common}
            options={[
              all,
              { value: 'accessible', label: t('library.holdings.available') },
              { value: 'unavailable', label: t('library.holdings.missing') },
              { value: 'unchecked', label: t('library.holdings.unknown') },
            ]}
            value={props.value.availability ?? ''}
            onValueChange={(v) => set('availability', v)}
          />
        </Field>
      </PopoverContent>
    </Popover>
  )
}
