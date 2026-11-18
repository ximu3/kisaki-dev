/** @fileoverview Selects the fields for one work preference branch in the staged editor. */

import { Match, Show, Switch } from 'solid-js'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Button } from '@kisaki3/desktop-ui/button'
import type { MainClient } from '../../../../../infrastructure/api'
import { errorMessage } from '../../../../../infrastructure/notifications'
import { createFontOptions } from '../../../domain-ui/fonts/options'
import type { PreferenceFields } from '../draft'
import { AnimeUsageFields, GameUsageFields, type UsageMedium } from './fields'
import { ReadingFields } from './reading'

/** Renders the selected medium's editable defaults inside the staged form. */
export function UsageEditorFields(props: {
  api: MainClient
  medium: UsageMedium
  draft: PreferenceFields
  manageFonts: () => void
}) {
  const { api, draft, medium } = props
  const reading = medium === 'comic' || medium === 'novel' ? medium : undefined

  return (
    <Switch>
      <Match when={medium === 'game'}>
        <GameUsageFields t={api.t} draft={draft} />
      </Match>
      <Match when={medium === 'anime'}>
        <AnimeUsageFields t={api.t} draft={draft} />
      </Match>
      <Match when={reading}>
        {(value) => (
          <ReadingUsageFields
            api={api}
            medium={value()}
            draft={draft}
            manageFonts={props.manageFonts}
          />
        )}
      </Match>
    </Switch>
  )
}

/** Loads font choices only when a reading form needs them. */
function ReadingUsageFields(props: {
  api: MainClient
  medium: 'comic' | 'novel'
  draft: PreferenceFields
  manageFonts: () => void
}) {
  const { api } = props
  const fonts = createFontOptions(api)

  return (
    <>
      <Show when={fonts.error()}>
        {(cause) => (
          <Alert tone="destructive" role="alert" class="mb-3">
            {errorMessage(cause())}{' '}
            <Button variant="outline" onClick={fonts.retry}>
              {api.t('runtime.retry')}
            </Button>
          </Alert>
        )}
      </Show>
      <ReadingFields
        medium={props.medium}
        t={api.t}
        draft={props.draft}
        users={fonts.users()}
        system={fonts.system()}
        loading={fonts.loading()}
        manageFonts={props.manageFonts}
      />
    </>
  )
}
