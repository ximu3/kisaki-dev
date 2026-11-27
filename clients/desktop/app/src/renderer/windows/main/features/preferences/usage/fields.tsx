import { For } from 'solid-js'
import { mdiChevronRight } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Button } from '@kisaki3/desktop-ui/button'
import { FieldGroup, FieldLegend } from '@kisaki3/desktop-ui/field'
import { Input, NumberInput } from '@kisaki3/desktop-ui/input'
import { List } from '@kisaki3/desktop-ui/list'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { PreferenceField, usePreferenceFields } from '../field'

export const usageMedia = ['game', 'anime', 'comic', 'novel'] as const

export type UsageMedium = (typeof usageMedia)[number]

export function UsageFields(props: { open: (medium: UsageMedium) => void }) {
  const { t, draft } = usePreferenceFields()

  return (
    <div class="grid gap-5">
      <FieldGroup>
        <PreferenceField
          field="usage.foregroundGracePeriodMs"
          description={t('preferences.usage.foregroundGracePeriodHint')}
          valueClass="w-36"
        >
          <NumberInput
            required
            unit={t('preferences.usage.minutesUnit')}
            step="any"
            min={0}
            value={draft.read('usage.foregroundGracePeriodMs') ?? ''}
            increaseLabel={t('controls.number.increase')}
            decreaseLabel={t('controls.number.decrease')}
            onValueChange={(value) => draft.writeNumber('usage.foregroundGracePeriodMs', value)}
          />
        </PreferenceField>
      </FieldGroup>

      <List variant="plain" class="gap-2" aria-label={t('preferences.sections.usage')}>
        <For each={usageMedia}>
          {(medium) => (
            <li>
              <Button
                class="w-full justify-between"
                variant="outline"
                data-usage-medium={medium}
                onClick={() => props.open(medium)}
              >
                {t(`preferences.usage.media.${medium}`)}
                <Icon path={mdiChevronRight} />
              </Button>
            </li>
          )}
        </For>
      </List>
    </div>
  )
}

export function GameUsageFields() {
  const { draft } = usePreferenceFields()

  return (
    <FieldGroup>
      <For each={['showPanelOnStart', 'panelAlwaysOnTop'] as const}>
        {(name) => {
          const key = `usage.game.${name}` as const
          return (
            <PreferenceField field={key} valueClass="w-fit">
              <Switch
                checked={draft.read(key)}
                onCheckedChange={(value) => draft.write(key, value)}
              />
            </PreferenceField>
          )
        }}
      </For>
    </FieldGroup>
  )
}

export function AnimeUsageFields() {
  const { t, draft } = usePreferenceFields()

  function multiplier(name: 'playbackSpeed' | 'subtitleScale') {
    const key = `usage.anime.${name}` as const
    return (
      <PreferenceField field={key} valueClass="w-36">
        <NumberInput
          required
          min={name === 'playbackSpeed' ? 0.01 : undefined}
          positive={name === 'subtitleScale'}
          max={100}
          unit="×"
          step="any"
          value={draft.read(key) ?? ''}
          increaseLabel={t('controls.number.increase')}
          decreaseLabel={t('controls.number.decrease')}
          onValueChange={(value) => draft.writeNumber(key, value)}
        />
      </PreferenceField>
    )
  }
  function toggle(name: 'subtitlesEnabled' | 'autoAdvance') {
    const key = `usage.anime.${name}` as const
    return (
      <PreferenceField field={key} valueClass="w-fit">
        <Switch checked={draft.read(key)} onCheckedChange={(value) => draft.write(key, value)} />
      </PreferenceField>
    )
  }
  function languages(name: 'audioLanguages' | 'subtitleLanguages') {
    const key = `usage.anime.${name}` as const
    return (
      <PreferenceField field={key}>
        <Input value={draft.read(key) ?? ''} onValueChange={(value) => draft.write(key, value)} />
      </PreferenceField>
    )
  }

  return (
    <div class="grid gap-5">
      <FieldGroup>
        <FieldLegend>{t('preferences.usage.groups.playback')}</FieldLegend>
        {multiplier('playbackSpeed')}
        {toggle('autoAdvance')}
      </FieldGroup>
      <FieldGroup>
        <FieldLegend>{t('preferences.usage.groups.tracks')}</FieldLegend>
        {languages('audioLanguages')}
        {toggle('subtitlesEnabled')}
        {languages('subtitleLanguages')}
        {multiplier('subtitleScale')}
      </FieldGroup>
    </div>
  )
}
