/** @fileoverview Connects appearance and language fields to their live native catalogs. */

import { createResource, onCleanup, Show } from 'solid-js'
import { Settings2 } from 'lucide-solid'
import { catalogKey } from '../../../../../shared/catalog-ref'
import { Tooltip, TooltipContent, TooltipTrigger } from '@kisaki3/desktop-ui/tooltip'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Button } from '@kisaki3/desktop-ui/button'
import { FieldAction } from '@kisaki3/desktop-ui/field'
import { Select } from '@kisaki3/desktop-ui/select'
import { errorMessage } from '../../../../infrastructure/notifications'
import type { MainClient } from '../../../../infrastructure/api'
import { ThemeSelector } from '../../domain-ui/themes/selector'
import type { PreferenceDraft } from './draft'
import { PreferenceField } from './field'

/** Reloads the selected catalog while the field is mounted. */
function createCatalog<T>(api: MainClient, topic: string, load: () => Promise<T>) {
  const [items, { refetch }] = createResource(load)
  const refresh = () => void refetch()
  api.topics.addEventListener(topic, refresh)
  onCleanup(() => api.topics.removeEventListener(topic, refresh))
  return { items, refresh }
}

/** Keeps the currently edited appearance choice when a catalog read can be retried. */
function CatalogError(props: { api: MainClient; error: unknown; retry: () => void }) {
  return (
    <Show when={props.error}>
      {(cause) => (
        <Alert tone="destructive" role="alert">
          {errorMessage(cause())}{' '}
          <Button variant="outline" onClick={props.retry}>
            {props.api.t('runtime.retry')}
          </Button>
        </Alert>
      )}
    </Show>
  )
}

/** Displays the theme choice beside the independent theme management action. */
export function ThemeField(props: { api: MainClient; draft: PreferenceDraft; manage: () => void }) {
  const { api, draft } = props
  const { items, refresh } = createCatalog(api, 'themes.changed', () => api.call('themes.list'))

  return (
    <>
      <PreferenceField field="appearance.theme" label={api.t('runtime.fields.theme')}>
        <ThemeSelector
          t={api.t}
          value={draft.read('appearance.theme')}
          themes={items.error ? [] : (items() ?? [])}
          disabled={!!items.error || items.loading}
          onValueChange={(ref) => draft.write('appearance.theme', ref)}
        />
        <Tooltip>
          <TooltipTrigger
            as={FieldAction}
            aria-label={api.t('runtime.manageThemes')}
            onClick={props.manage}
          >
            <Settings2 />
          </TooltipTrigger>
          <TooltipContent>{api.t('runtime.manage')}</TooltipContent>
        </Tooltip>
      </PreferenceField>
      <CatalogError api={api} error={items.error} retry={refresh} />
    </>
  )
}

/** Displays the saved translation, including an unavailable resource identity. */
export function TranslationField(props: { api: MainClient; draft: PreferenceDraft }) {
  const { api, draft } = props
  const { items, refresh } = createCatalog(api, 'translations.changed', () =>
    api.call('translations.list'),
  )
  const value = () => draft.read('general.uiTranslation')
  const key = () => {
    const ref = value()
    return ref ? catalogKey(ref) : 'unavailable'
  }

  function options() {
    const rows = (items.error ? [] : (items() ?? [])).map((item) => ({
      value: catalogKey(item.ref),
      label: item.name,
    }))
    if (rows.some((item) => item.value === key())) {
      return rows
    }
    const ref = value()
    const name = ref?.type === 'extension' ? ref.extensionId + ' / ' + ref.id : ref?.id
    return [
      ...rows,
      {
        value: key(),
        label: name ? api.t('runtime.unavailableResource', { name }) : api.t('runtime.unavailable'),
      },
    ]
  }

  return (
    <>
      <PreferenceField field="general.uiTranslation" label={api.t('runtime.fields.uiTranslation')}>
        <Select
          value={key()}
          disabled={!!items.error || items.loading}
          options={options()}
          emptyMessage={api.t('runtime.noOptions')}
          invalidSelectionMessage={api.t('runtime.unavailable')}
          onValueChange={(key) => {
            const item = items()?.find((entry) => catalogKey(entry.ref) === key)
            if (item) {
              draft.write('general.uiTranslation', item.ref)
            }
          }}
        />
      </PreferenceField>
      <CatalogError api={api} error={items.error} retry={refresh} />
    </>
  )
}
