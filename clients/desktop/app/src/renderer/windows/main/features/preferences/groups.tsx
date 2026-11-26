import { For } from 'solid-js'
import { appearanceModes, interfaceScaleRange } from '@kisaki3/desktop-contracts/appearance'
import { FieldGroup } from '@kisaki3/desktop-ui/field'
import { NumberInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { Alert } from '@kisaki3/desktop-ui/alert'
import type { MainClient } from '../../../../infrastructure/api'
import { appearanceIssueMessage } from '../../../../infrastructure/notifications'
import { PageOrder, type NavigationPage } from '../../domain-ui/navigation/list'
import { PreferenceField, usePreferenceFields } from './field'
import { ThemeField, TranslationField } from './catalog-fields'

export function GeneralFields(props: { api: MainClient }) {
  const { draft, t } = usePreferenceFields()

  return (
    <FieldGroup>
      <TranslationField api={props.api} />
      <PreferenceField field="general.closeMainWindow" label={t('runtime.fields.closeMainWindow')}>
        <Select
          value={draft.read('general.closeMainWindow') ?? ''}
          options={(['background', 'quit'] as const).map((value) => ({
            value,
            label: t(`runtime.choices.${value}`),
          }))}
          emptyMessage={t('runtime.noOptions')}
          invalidSelectionMessage={t('runtime.unavailable')}
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

export function AppearanceFields(props: { api: MainClient; manage: () => void }) {
  const { draft, t } = usePreferenceFields()

  return (
    <FieldGroup>
      <For each={props.api.appearanceIssues()}>
        {(issue) => <Alert tone="warning">{appearanceIssueMessage(t, issue)}</Alert>}
      </For>
      <ThemeField api={props.api} manage={props.manage} />
      <PreferenceField field="appearance.mode" label={t('runtime.fields.mode')}>
        <Select
          value={draft.read('appearance.mode') ?? ''}
          options={appearanceModes.map((value) => ({
            value,
            label: t(`runtime.choices.${value}`),
          }))}
          emptyMessage={t('runtime.noOptions')}
          invalidSelectionMessage={t('runtime.unavailable')}
          onValueChange={(v) => {
            if (v) {
              draft.write('appearance.mode', v)
            }
          }}
        />
      </PreferenceField>
      <PreferenceField
        field="appearance.interfaceScale"
        label={t('runtime.fields.interfaceScale')}
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
          onValueChange={(v) => draft.writeNumber('appearance.interfaceScale', v)}
          increaseLabel={t('runtime.increase')}
          decreaseLabel={t('runtime.decrease')}
        />
      </PreferenceField>
    </FieldGroup>
  )
}

export function NavigationFields(props: { pages: readonly NavigationPage[] }) {
  const { draft, t } = usePreferenceFields()

  return (
    <FieldGroup>
      <PreferenceField field="navigation.order" wide label={t('runtime.fields.order')}>
        <PageOrder
          t={t}
          pages={props.pages}
          order={draft.read('navigation.order') ?? []}
          visibleLimit={Number(draft.read('navigation.visibleLimit'))}
          change={(order) => draft.write('navigation.order', order)}
        />
      </PreferenceField>
      <PreferenceField
        field="navigation.visibleLimit"
        label={t('runtime.fields.visibleLimit')}
        valueClass="w-36"
      >
        <NumberInput
          min={0}
          step={1}
          required
          value={draft.read('navigation.visibleLimit') ?? ''}
          onValueChange={(v) => draft.writeNumber('navigation.visibleLimit', v)}
          increaseLabel={t('runtime.increase')}
          decreaseLabel={t('runtime.decrease')}
        />
      </PreferenceField>
    </FieldGroup>
  )
}

export function LibraryFields() {
  const { draft, t } = usePreferenceFields()

  return (
    <FieldGroup>
      <For each={['showNsfw', 'autoRefreshHoldings'] as const}>
        {(name) => {
          const key = `library.${name}` as const
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

export function UpdateFields() {
  const { draft, t } = usePreferenceFields()

  return (
    <FieldGroup>
      <For each={['autoCheck', 'allowPrerelease'] as const}>
        {(name) => {
          const key = `updates.${name}` as const
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
