import { Match, Switch } from 'solid-js'
import type { MainClient } from '../../../../../infrastructure/api'
import { createFontOptions } from '../../../domain-ui/fonts/options'
import type { PreferenceFields } from '../draft'
import { AnimeUsageFields, GameUsageFields, type UsageMedium } from './fields'
import { ReadingFields } from './reading'
import { QueryError } from '../../../../../infrastructure/query/error'

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
      <QueryError
        error={fonts.error()}
        retryLabel={api.t('runtime.retry')}
        retry={fonts.retry}
        class="mb-3"
      />
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
