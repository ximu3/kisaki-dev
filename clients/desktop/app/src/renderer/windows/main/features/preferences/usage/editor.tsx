import { Match, Switch } from 'solid-js'
import type { MainClient } from '../../../../../infrastructure/api'
import { AnimeUsageFields } from '../../../domain-ui/preferences/playback-fields'
import { GameUsageFields, type UsageMedium } from './fields'
import { ReadingFields } from '../../../domain-ui/preferences/reading-fields'

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
        {(value) => <ReadingFields api={api} medium={value()} manageFonts={props.manageFonts} />}
      </Match>
    </Switch>
  )
}
