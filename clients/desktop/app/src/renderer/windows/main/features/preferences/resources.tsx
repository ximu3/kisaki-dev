import { createMemo, onSettled } from 'solid-js'
import { createSnapshot } from '../../../../infrastructure/query'
import { mdiTuneVariant } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { catalogKey } from '../../../../../shared/catalog-ref'
import { Tooltip, TooltipContent, TooltipTrigger } from '@kisaki3/desktop-ui/tooltip'
import { FieldAction } from '@kisaki3/desktop-ui/field'
import { Select } from '@kisaki3/desktop-ui/select'
import type { MainClient } from '../../../../infrastructure/api'
import { ThemeSelector } from '../../domain-ui/themes/selector'
import { catalogSelection } from '../../domain-ui/catalog-selection'
import { PreferenceField, usePreferenceFields } from './field'
import { QueryError } from '../../../../infrastructure/query/error'

function createCatalog<T>(
  api: MainClient,
  topic: string,
  load: (signal: AbortSignal) => Promise<T>,
) {
  const items = createSnapshot(load)
  const refresh = () => void items.reload()
  onSettled(() => {
    api.topics.addEventListener(topic, refresh)
    return () => api.topics.removeEventListener(topic, refresh)
  })
  return { items, refresh }
}

export function ThemeField(props: { api: MainClient; manage: () => void }) {
  const { api } = props
  const { draft, t } = usePreferenceFields()
  const { items, refresh } = createCatalog(api, 'themes.changed', (signal) =>
    api.request(signal, 'themes.list'),
  )

  return (
    <>
      <PreferenceField field="appearance.theme" label={t('runtime.fields.theme')}>
        <ThemeSelector
          t={t}
          value={draft.read('appearance.theme')}
          themes={items.result()?.value}
          loading={items.pending()}
          disabled={items.pending() || !!items.result()?.error}
          onValueChange={(ref) => draft.write('appearance.theme', ref)}
        />
        <Tooltip>
          <TooltipTrigger
            as={FieldAction}
            aria-label={t('runtime.manageThemes')}
            onClick={props.manage}
          >
            <Icon path={mdiTuneVariant} />
          </TooltipTrigger>
          <TooltipContent>{t('runtime.manage')}</TooltipContent>
        </Tooltip>
      </PreferenceField>
      <QueryError retryLabel={t('runtime.retry')} error={items.result()?.error} retry={refresh} />
    </>
  )
}

export function TranslationField(props: { api: MainClient }) {
  const { api } = props
  const { draft, t } = usePreferenceFields()
  const { items, refresh } = createCatalog(api, 'translations.changed', (signal) =>
    api.request(signal, 'translations.list'),
  )
  const selection = createMemo(() =>
    catalogSelection(
      items.result()?.value?.map((item) => ({ value: catalogKey(item.ref), label: item.name })),
      draft.read('general.uiTranslation'),
      t,
    ),
  )

  return (
    <>
      <PreferenceField field="general.uiTranslation" label={t('runtime.fields.uiTranslation')}>
        <Select
          value={selection().value}
          options={selection().options}
          placeholder={items.pending() ? t('runtime.loading') : ''}
          aria-busy={items.pending() ? 'true' : undefined}
          disabled={items.pending() || !!items.result()?.error}
          emptyMessage={t('runtime.noOptions')}
          invalidSelectionMessage={t('runtime.unavailable')}
          onValueChange={(key) => {
            const item = items.result()?.value?.find((entry) => catalogKey(entry.ref) === key)
            if (item) {
              draft.write('general.uiTranslation', item.ref)
            }
          }}
        />
      </PreferenceField>
      <QueryError retryLabel={t('runtime.retry')} error={items.result()?.error} retry={refresh} />
    </>
  )
}
