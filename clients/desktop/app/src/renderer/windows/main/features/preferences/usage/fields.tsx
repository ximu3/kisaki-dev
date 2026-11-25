import { For } from 'solid-js'
import { mdiChevronRight } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Button } from '@kisaki3/desktop-ui/button'
import { FieldGroup, FieldLegend } from '@kisaki3/desktop-ui/field'
import { Input, NumberInput } from '@kisaki3/desktop-ui/input'
import { List } from '@kisaki3/desktop-ui/list'
import { Switch } from '@kisaki3/desktop-ui/switch'
import type { Translate } from '@kisaki3/desktop-localization'
import type { PreferenceFields } from '../draft'
import { PreferenceField } from '../field'

export const usageMedia = ['game', 'anime', 'comic', 'novel'] as const

export type UsageMedium = (typeof usageMedia)[number]

interface UsageFieldsProps {
  t: Translate
  draft: PreferenceFields
}

export function UsageFields(props: UsageFieldsProps & { open: (medium: UsageMedium) => void }) {
  const { t, draft } = props

  return (
    <div class="grid gap-5">
      <FieldGroup>
        <PreferenceField
          field="usage.foregroundGracePeriodMs"
          label={t('runtime.fields.foregroundGracePeriodMs')}
          description={t('runtime.foregroundGracePeriodDescription')}
          valueClass="w-36"
        >
          <NumberInput
            required
            unit="ms"
            min={0}
            value={draft.read('usage.foregroundGracePeriodMs') ?? ''}
            increaseLabel={t('runtime.increase')}
            decreaseLabel={t('runtime.decrease')}
            onValueChange={(value) => draft.writeNumber('usage.foregroundGracePeriodMs', value)}
          />
        </PreferenceField>
      </FieldGroup>

      <List variant="plain" class="gap-2" aria-label={t('runtime.fields.usage')}>
        <For each={usageMedia}>
          {(medium) => (
            <li>
              <Button
                class="w-full justify-between"
                variant="outline"
                data-usage-medium={medium}
                onClick={() => props.open(medium)}
              >
                {t(`runtime.fields.${medium}`)}
                <Icon path={mdiChevronRight} />
              </Button>
            </li>
          )}
        </For>
      </List>
    </div>
  )
}

export function GameUsageFields(props: UsageFieldsProps) {
  const { t, draft } = props

  return (
    <FieldGroup>
      <For each={['showPanelOnStart', 'panelAlwaysOnTop'] as const}>
        {(name) => {
          const key = `usage.game.${name}` as const
          return (
            <PreferenceField field={key} label={t(`runtime.fields.${name}`)} valueClass="w-fit">
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

export function AnimeUsageFields(props: UsageFieldsProps) {
  const { t, draft } = props

  function multiplier(name: 'playbackSpeed' | 'subtitleScale') {
    const key = `usage.anime.${name}` as const
    return (
      <PreferenceField field={key} label={t(`runtime.fields.${name}`)} valueClass="w-36">
        <NumberInput
          required
          min={name === 'playbackSpeed' ? 0.01 : 0}
          max={100}
          unit="×"
          step="any"
          value={draft.read(key) ?? ''}
          increaseLabel={t('runtime.increase')}
          decreaseLabel={t('runtime.decrease')}
          onValueChange={(value) => draft.writeNumber(key, value)}
        />
      </PreferenceField>
    )
  }
  function toggle(name: 'subtitlesEnabled' | 'autoAdvance') {
    const key = `usage.anime.${name}` as const
    return (
      <PreferenceField field={key} label={t(`runtime.fields.${name}`)} valueClass="w-fit">
        <Switch checked={draft.read(key)} onCheckedChange={(value) => draft.write(key, value)} />
      </PreferenceField>
    )
  }
  function languages(name: 'audioLanguages' | 'subtitleLanguages') {
    const key = `usage.anime.${name}` as const
    return (
      <PreferenceField field={key} label={t(`runtime.fields.${name}`)}>
        <Input value={draft.read(key) ?? ''} onValueChange={(value) => draft.write(key, value)} />
      </PreferenceField>
    )
  }

  return (
    <div class="grid gap-5">
      <FieldGroup>
        <FieldLegend>{t('runtime.usageGroups.playback')}</FieldLegend>
        {multiplier('playbackSpeed')}
        {toggle('autoAdvance')}
      </FieldGroup>
      <FieldGroup>
        <FieldLegend>{t('runtime.usageGroups.tracks')}</FieldLegend>
        {languages('audioLanguages')}
        {toggle('subtitlesEnabled')}
        {languages('subtitleLanguages')}
        {multiplier('subtitleScale')}
      </FieldGroup>
    </div>
  )
}
