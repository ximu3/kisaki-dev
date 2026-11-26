import { Match, Switch } from 'solid-js'
import type { MainClient } from '../../../../../infrastructure/api'
import { createFontOptions } from '../../../domain-ui/fonts/options'
import { AnimeUsageFields, GameUsageFields, type UsageMedium } from './fields'
import { ReadingFields } from './reading'
import { QueryError } from '../../../../../infrastructure/query/error'

export function UsageEditorFields(props: {
  api: MainClient
  medium: UsageMedium
  manageFonts: () => void
}) {
  const { api, medium } = props
  const reading = medium === 'comic' || medium === 'novel' ? medium : undefined

  return (
    <Switch>
      <Match when={medium === 'game'}>
        <GameUsageFields />
      </Match>
      <Match when={medium === 'anime'}>
        <AnimeUsageFields />
      </Match>
      <Match when={reading}>
        {(value) => (
          <ReadingUsageFields api={api} medium={value()} manageFonts={props.manageFonts} />
        )}
      </Match>
    </Switch>
  )
}

function ReadingUsageFields(props: {
  api: MainClient
  medium: 'comic' | 'novel'
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
        users={fonts.users()}
        system={fonts.system()}
        loading={fonts.loading()}
        manageFonts={props.manageFonts}
      />
    </>
  )
}
