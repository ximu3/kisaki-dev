import { FieldGroup, FieldLegend } from '@kisaki3/desktop-ui/field'
import { Input, NumberInput } from '@kisaki3/desktop-ui/input'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { PreferenceField, usePreferenceFields } from './field'

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
