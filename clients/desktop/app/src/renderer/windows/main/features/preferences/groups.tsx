/** @fileoverview Presents the short preference groups in the shared draft. */

import { For } from 'solid-js'
import { appearanceModes, interfaceScaleRange } from '@kisaki3/desktop-contracts/appearance'
import { FieldGroup } from '@kisaki3/desktop-ui/field'
import { NumberInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { Switch as Toggle } from '@kisaki3/desktop-ui/switch'
import type { MainClient } from '../../../../infrastructure/api'
import { PageOrder, type NavigationPage } from '../../domain-ui/navigation/list'
import type { PreferenceDraft } from './draft'
import { PreferenceField } from './field'
import { ThemeField, TranslationField } from './resources'

/** Draft and current translations needed by these preference panels. */
interface GroupProps {
  api: MainClient
  draft: PreferenceDraft
}

/** Edits the general group's fields against the surrounding draft. */
export function GeneralFields(props: GroupProps) {
  const { api, draft } = props

  return (
    <FieldGroup>
      <TranslationField api={api} draft={draft} />
      <PreferenceField
        field="general.closeMainWindow"
        label={api.t('runtime.fields.closeMainWindow')}
      >
        <Select
          value={draft.read('general.closeMainWindow') ?? ''}
          options={(['background', 'quit'] as const).map((value) => ({
            value,
            label: api.t(`runtime.choices.${value}`),
          }))}
          emptyMessage={api.t('runtime.noOptions')}
          invalidSelectionMessage={api.t('runtime.unavailable')}
          onValueChange={(v) => {
            if (v) {
              draft.write('general.closeMainWindow', v)
            }
          }}
        />
      </PreferenceField>
    </FieldGroup>
  )
}

/** Edits the appearance group's fields against the surrounding draft. */
export function AppearanceFields(props: GroupProps & { manage: () => void }) {
  const { api, draft } = props

  return (
    <FieldGroup>
      <ThemeField api={api} draft={draft} manage={props.manage} />
      <PreferenceField field="appearance.mode" label={api.t('runtime.fields.mode')}>
        <Select
          value={draft.read('appearance.mode') ?? ''}
          options={appearanceModes.map((value) => ({
            value,
            label: api.t(`runtime.choices.${value}`),
          }))}
          emptyMessage={api.t('runtime.noOptions')}
          invalidSelectionMessage={api.t('runtime.unavailable')}
          onValueChange={(v) => {
            if (v) {
              draft.write('appearance.mode', v)
            }
          }}
        />
      </PreferenceField>
      <PreferenceField
        field="appearance.interfaceScale"
        label={api.t('runtime.fields.interfaceScale')}
        valueClass="w-36"
      >
        <NumberInput
          required
          unit="%"
          min={interfaceScaleRange.min}
          max={interfaceScaleRange.max}
          stepCount={5}
          step={1}
          value={draft.read('appearance.interfaceScale') ?? ''}
          onValueChange={(v) => draft.write('appearance.interfaceScale', v)}
          increaseLabel={api.t('runtime.increase')}
          decreaseLabel={api.t('runtime.decrease')}
        />
      </PreferenceField>
    </FieldGroup>
  )
}

/** Edits the navigation group's fields against the surrounding draft. */
export function NavigationFields(props: GroupProps & { pages: readonly NavigationPage[] }) {
  const { api, draft } = props

  return (
    <FieldGroup>
      <PreferenceField field="navigation.order" wide label={api.t('runtime.fields.order')}>
        <PageOrder
          t={api.t}
          pages={props.pages}
          order={draft.read('navigation.order') ?? []}
          visibleLimit={Number(draft.read('navigation.visibleLimit'))}
          change={(order) => draft.write('navigation.order', order)}
        />
      </PreferenceField>
      <PreferenceField
        field="navigation.visibleLimit"
        label={api.t('runtime.fields.visibleLimit')}
        valueClass="w-36"
      >
        <NumberInput
          min={0}
          step={1}
          required
          value={draft.read('navigation.visibleLimit') ?? ''}
          onValueChange={(v) => draft.write('navigation.visibleLimit', v)}
          increaseLabel={api.t('runtime.increase')}
          decreaseLabel={api.t('runtime.decrease')}
        />
      </PreferenceField>
    </FieldGroup>
  )
}

/** Edits the library group's fields against the surrounding draft. */
export function LibraryFields(props: GroupProps) {
  const { api, draft } = props

  return (
    <FieldGroup>
      <For each={['showNsfw', 'autoRefreshHoldings'] as const}>
        {(name) => {
          const key = `library.${name}` as const
          return (
            <PreferenceField field={key} label={api.t(`runtime.fields.${name}`)} valueClass="w-fit">
              <Toggle checked={draft.read(key)} onCheckedChange={(v) => draft.write(key, v)} />
            </PreferenceField>
          )
        }}
      </For>
    </FieldGroup>
  )
}

/** Edits the updates group's fields against the surrounding draft. */
export function UpdateFields(props: GroupProps) {
  const { api, draft } = props

  return (
    <FieldGroup>
      <For each={['autoCheck', 'allowPrerelease'] as const}>
        {(name) => {
          const key = `updates.${name}` as const
          return (
            <PreferenceField field={key} label={api.t(`runtime.fields.${name}`)} valueClass="w-fit">
              <Toggle checked={draft.read(key)} onCheckedChange={(v) => draft.write(key, v)} />
            </PreferenceField>
          )
        }}
      </For>
    </FieldGroup>
  )
}
