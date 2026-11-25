import { createMemo, onCleanup } from 'solid-js'
import { createQuery } from '../../../../infrastructure/query'
import { mdiTuneVariant } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { catalogKey } from '../../../../../shared/catalog-ref'
import { Tooltip, TooltipContent, TooltipTrigger } from '@kisaki3/desktop-ui/tooltip'
import { FieldAction } from '@kisaki3/desktop-ui/field'
import { Select } from '@kisaki3/desktop-ui/select'
import type { MainClient } from '../../../../infrastructure/api'
import { ThemeSelector } from '../../domain-ui/themes/selector'
import { catalogSelection } from '../../domain-ui/catalog-selection'
import type { PreferenceDraft } from './draft'
import { PreferenceField } from './field'
import { QueryError } from '../../../../infrastructure/query/error'

function createCatalog<T>(
  api: MainClient,
  topic: string,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const items = createQuery(load)
  const refresh = () => void items.reload()
  api.topics.addEventListener(topic, refresh)
  onCleanup(() => api.topics.removeEventListener(topic, refresh))
  return { items, refresh }
}

export function ThemeField(props: { api: MainClient; draft: PreferenceDraft; manage: () => void }) {
  const { api, draft } = props
  const { items, refresh } = createCatalog(api, 'themes.changed', (signal) =>
    api.request(signal, 'themes.list'),
  )

  return (
    <>
      <PreferenceField field="appearance.theme" label={api.t('runtime.fields.theme')}>
        <ThemeSelector
          t={api.t}
          value={draft.read('appearance.theme')}
          themes={items.value}
          loading={items.pending}
          disabled={items.pending || !!items.error}
          onValueChange={(ref) => draft.write('appearance.theme', ref)}
        />
        <Tooltip>
          <TooltipTrigger
            as={FieldAction}
            aria-label={api.t('runtime.manageThemes')}
            onClick={props.manage}
          >
            <Icon path={mdiTuneVariant} />
          </TooltipTrigger>
          <TooltipContent>{api.t('runtime.manage')}</TooltipContent>
        </Tooltip>
      </PreferenceField>
      <QueryError retryLabel={api.t('runtime.retry')} error={items.error} retry={refresh} />
    </>
  )
}

export function TranslationField(props: { api: MainClient; draft: PreferenceDraft }) {
  const { api, draft } = props
  const { items, refresh } = createCatalog(api, 'translations.changed', (signal) =>
    api.request(signal, 'translations.list'),
  )
  const selection = createMemo(() =>
    catalogSelection(
      items.value?.map((item) => ({ value: catalogKey(item.ref), label: item.name })),
      draft.read('general.uiTranslation'),
      api.t,
    ),
  )

  return (
    <>
      <PreferenceField field="general.uiTranslation" label={api.t('runtime.fields.uiTranslation')}>
        <Select
          value={selection().value}
          options={selection().options}
          placeholder={items.pending ? api.t('runtime.loading') : ''}
          aria-busy={items.pending ? 'true' : undefined}
          disabled={items.pending || !!items.error}
          emptyMessage={api.t('runtime.noOptions')}
          invalidSelectionMessage={api.t('runtime.unavailable')}
          onValueChange={(key) => {
            const item = items.value?.find((entry) => catalogKey(entry.ref) === key)
            if (item) {
              draft.write('general.uiTranslation', item.ref)
            }
          }}
        />
      </PreferenceField>
      <QueryError retryLabel={api.t('runtime.retry')} error={items.error} retry={refresh} />
    </>
  )
}
