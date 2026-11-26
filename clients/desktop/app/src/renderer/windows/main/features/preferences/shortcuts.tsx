import { For } from 'solid-js'
import { shortcutKeys, type DesktopPlatform } from '@kisaki3/desktop-contracts/preferences'
import { FieldGroup, FieldLegend } from '@kisaki3/desktop-ui/field'
import { ShortcutInput } from '@kisaki3/desktop-ui/input'
import type { englishMessages } from '@kisaki3/desktop-localization'
import { captureShortcut, shortcutKeycaps } from '../../../../infrastructure/shortcuts'
import { PreferenceField, usePreferenceFields } from './field'

const scopes = {
  main: 'runtime.mainWindow',
  editor: 'runtime.editor',
  reader: 'runtime.reader',
  player: 'runtime.player',
  game: 'runtime.game-panel',
} as const

export function ShortcutFields(props: { platform: DesktopPlatform }) {
  const { draft, t } = usePreferenceFields()
  return (
    <div class="space-y-5">
      <For each={Object.entries(scopes)}>
        {([scope, heading]) => (
          <FieldGroup class="gap-2">
            <FieldLegend>{t(heading)}</FieldLegend>
            <For each={shortcutKeys.filter((key) => key.startsWith(scope + '.'))}>
              {(key) => {
                const field = `shortcuts.${key}` as const
                const action = key.slice(
                  key.indexOf('.') + 1,
                ) as keyof typeof englishMessages.runtime.fields
                const label = () => t(`runtime.fields.${action}`)
                const bindings = () => draft.read(field) ?? []

                return (
                  <PreferenceField field={field} label={label()} valueClass="w-80">
                    <ShortcutInput
                      label={t('runtime.recordBinding', { name: label() })}
                      removeLabel={(binding) =>
                        t('runtime.removeBinding', { name: label(), binding })
                      }
                      scrollPreviousLabel={t('runtime.previousBindings')}
                      scrollNextLabel={t('runtime.nextBindings')}
                      recordingLabel={t('runtime.pressShortcut')}
                      duplicateLabel={t('runtime.bindingExists')}
                      resetLabel={t('actions.reset')}
                      cancelLabel={t('actions.cancel')}
                      confirmLabel={t('actions.confirm')}
                      emptyLabel={t('runtime.unbound')}
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
