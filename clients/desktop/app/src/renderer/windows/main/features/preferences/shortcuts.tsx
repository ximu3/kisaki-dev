import { For } from 'solid-js'
import { shortcutKeys, type DesktopPlatform } from '@kisaki3/desktop-contracts/preferences'
import { FieldGroup, FieldLegend } from '@kisaki3/desktop-ui/field'
import { ShortcutInput } from '@kisaki3/desktop-ui/input'
import { formatPreferenceField, formatShortcutScope } from '@kisaki3/desktop-localization'
import { captureShortcut, shortcutKeycaps } from '../../../../infrastructure/shortcuts'
import { PreferenceField, usePreferenceFields } from '../../domain-ui/preferences/field'

const scopes = ['main', 'editor', 'reader', 'player', 'game'] as const

export function ShortcutFields(props: { platform: DesktopPlatform }) {
  const { draft, t } = usePreferenceFields()
  return (
    <div class="space-y-5">
      <For each={scopes}>
        {(scope) => (
          <FieldGroup class="gap-2">
            <FieldLegend>{formatShortcutScope(t, scope)}</FieldLegend>
            <For each={shortcutKeys.filter((key) => key.startsWith(scope + '.'))}>
              {(key) => {
                const field = `shortcuts.${key}` as const
                const label = () => formatPreferenceField(t, field)
                const bindings = () => draft.read(field) ?? []

                return (
                  <PreferenceField field={field} valueClass="w-80">
                    <ShortcutInput
                      label={t('shortcuts.record', { name: label() })}
                      removeLabel={(binding) => t('shortcuts.remove', { name: label(), binding })}
                      scrollPreviousLabel={t('shortcuts.previous')}
                      scrollNextLabel={t('shortcuts.next')}
                      recordingLabel={t('shortcuts.prompt')}
                      duplicateLabel={t('shortcuts.duplicate')}
                      resetLabel={t('actions.reset')}
                      cancelLabel={t('actions.cancel')}
                      confirmLabel={t('actions.confirm')}
                      emptyLabel={t('shortcuts.unbound')}
                      value={bindings()}
                      capture={(event) => captureShortcut(event, bindings(), props.platform)}
                      keycaps={(value) => shortcutKeycaps(value, props.platform)}
                      onValueChange={(keys) => draft.write(field, keys)}
                    />
                  </PreferenceField>
                )
              }}
            </For>
          </FieldGroup>
        )}
      </For>
    </div>
  )
}
