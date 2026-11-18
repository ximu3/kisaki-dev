/** @fileoverview Edits bindings by their native window and editor scope. */

import { For } from 'solid-js'
import { shortcutKeys, type DesktopPlatform } from '@kisaki3/desktop-contracts/preferences'
import { FieldGroup, FieldLegend } from '@kisaki3/desktop-ui/field'
import { ShortcutInput } from '@kisaki3/desktop-ui/input'
import type { Translate, englishMessages } from '@kisaki3/desktop-localization'
import { captureShortcut, shortcutKeycaps } from '../../../../infrastructure/shortcuts'
import { PreferenceField } from './field'
import type { PreferenceDraft } from './draft'

/** Each scope has its own localized heading and independent set of allowed actions. */
const scopes = {
  main: 'runtime.mainWindow',
  editor: 'runtime.editor',
  reader: 'runtime.reader',
  player: 'runtime.player',
  game: 'runtime.game-panel',
} as const

/** Preserves the other bindings and groups while editing a single action. */
export function ShortcutFields(props: {
  t: Translate
  draft: PreferenceDraft
  platform: DesktopPlatform
}) {
  return (
    <div class="space-y-5">
      <For each={Object.entries(scopes)}>
        {([scope, heading]) => (
          <FieldGroup class="gap-2">
            <FieldLegend>{props.t(heading)}</FieldLegend>
            <For each={shortcutKeys.filter((key) => key.startsWith(scope + '.'))}>
              {(key) => {
                const field = `shortcuts.${key}` as const
                const action = key.slice(
                  key.indexOf('.') + 1,
                ) as keyof typeof englishMessages.runtime.fields
                const label = () => props.t(`runtime.fields.${action}`)
                const bindings = () => props.draft.read(field) ?? []

                return (
                  <PreferenceField field={field} label={label()} valueClass="w-80">
                    <ShortcutInput
                      label={props.t('runtime.recordBinding', { name: label() })}
                      removeLabel={(binding) =>
                        props.t('runtime.removeBinding', { name: label(), binding })
                      }
                      scrollPreviousLabel={props.t('runtime.previousBindings')}
                      scrollNextLabel={props.t('runtime.nextBindings')}
                      recordingLabel={props.t('runtime.pressShortcut')}
                      duplicateLabel={props.t('runtime.bindingExists')}
                      resetLabel={props.t('actions.reset')}
                      cancelLabel={props.t('actions.cancel')}
                      confirmLabel={props.t('actions.confirm')}
                      emptyLabel={props.t('runtime.unbound')}
                      value={bindings()}
                      capture={(event) => captureShortcut(event, bindings(), props.platform)}
                      keycaps={(value) => shortcutKeycaps(value, props.platform)}
                      onValueChange={(keys) => props.draft.write(field, keys)}
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
