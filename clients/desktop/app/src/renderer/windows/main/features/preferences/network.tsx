import { onSettled, Show } from 'solid-js'
import { createViewQuery } from '../../../../infrastructure/query'
import type { ProxyCredentials } from '@kisaki3/desktop-contracts/network'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Button } from '@kisaki3/desktop-ui/button'
import { Field, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Input } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import type { MainClient } from '../../../../infrastructure/api'
import {
  focusPreferenceValue,
  PreferenceField,
  usePreferenceFields,
} from '../../domain-ui/preferences/field'
import { QueryError } from '../../../../infrastructure/query/error'

export const proxyCredentialsKey = 'network.credentials'

export function NetworkFields(props: {
  api: MainClient
  forceDetails: boolean
  clearDetails: () => void
  configureCredentials: () => void
}) {
  const { api } = props
  const { draft, t } = usePreferenceFields()
  const state = createViewQuery((signal) => api.request(signal, 'network.state'))
  const refresh = () => void state.reload()
  onSettled(() => {
    api.topics.addEventListener('network.changed', refresh)
    return () => api.topics.removeEventListener('network.changed', refresh)
  })

  const adoption = () => state.result()?.value
  const failure = () => {
    const current = adoption()
    return current?.status === 'failed' ? current.error : undefined
  }

  const mode = () => draft.read('network.mode') ?? ''
  const endpoint = () => draft.read('network.endpoint') ?? ''

  function removeCredentials(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
    const field = event.currentTarget.closest<HTMLElement>('[data-field-key]')!
    draft.write(proxyCredentialsKey, null)
    focusPreferenceValue(field)
  }

  return (
    <div class="space-y-5">
      <FieldGroup>
        <PreferenceField field="network.mode">
          <Select
            value={mode()}
            options={(['system', 'direct', 'manual'] as const).map((value) => ({
              value,
              label: t(`preferences.network.modes.${value}`),
            }))}
            emptyMessage={t('controls.search.empty')}
            invalidSelectionMessage={t('controls.feedback.unavailable')}
            onValueChange={(value) => {
              if (value) {
                draft.write('network.mode', value)
                props.clearDetails()
              }
            }}
          />
        </PreferenceField>
        <Show when={mode() === 'manual' || props.forceDetails}>
          <PreferenceField field="network.endpoint" wide>
            <Input
              placeholder="http://proxy.example:8080"
              value={endpoint()}
              onValueChange={(value) => draft.write('network.endpoint', value || null)}
            />
          </PreferenceField>
          <PreferenceField
            field="network.bypassRules"
            wide
            description={t('preferences.network.bypassRulesHint')}
          >
            <Input
              placeholder="*.example.com, 192.0.2.10"
              value={draft.read('network.bypassRules') ?? ''}
              onValueChange={(value) => draft.write('network.bypassRules', value)}
            />
          </PreferenceField>
          <PreferenceField field={proxyCredentialsKey} valueClass="w-fit">
            <Show when={draft.read(proxyCredentialsKey)}>
              <Button variant="outline" onClick={removeCredentials}>
                {t('actions.remove')}
              </Button>
            </Show>
            <Button
              variant="outline"
              aria-haspopup="dialog"
              data-focus-anchor
              disabled={endpoint().toLowerCase().startsWith('socks5:')}
              onClick={props.configureCredentials}
            >
              {t('actions.configure')}
            </Button>
          </PreferenceField>
        </Show>
      </FieldGroup>

      <QueryError error={state.result()?.error} retryLabel={t('actions.retry')} retry={refresh} />
      <Show when={adoption()?.status === 'applying'}>
        <p role="status" class="m-0 text-sm text-muted-foreground">
          {t('preferences.network.applying')}
        </p>
      </Show>
      <Show when={failure()}>
        {(error) => (
          <Alert tone="destructive" role="alert">
            <strong>{t('preferences.network.failed')}</strong>
            <div>{error().message}</div>
          </Alert>
        )}
      </Show>
    </div>
  )
}

export function ProxyCredentialFields() {
  const { t, draft } = usePreferenceFields()
  const entered = () => {
    const value = draft.read(proxyCredentialsKey)
    return value && 'username' in value ? value : undefined
  }

  function edit(field: keyof ProxyCredentials, value: string) {
    const current = entered()
    const next = {
      username: current?.username ?? '',
      password: current?.password ?? '',
      [field]: value,
    }
    draft.write(proxyCredentialsKey, next.username || next.password ? next : null)
  }

  return (
    <FieldGroup data-field-key={proxyCredentialsKey} tabindex={-1}>
      <div data-preference-value class="grid gap-3">
        <Field name={proxyCredentialsKey}>
          <FieldLabel>{t('preferences.network.username')}</FieldLabel>
          <Input
            autofocus
            autocomplete="off"
            value={entered()?.username ?? ''}
            onValueChange={(value) => edit('username', value)}
          />
        </Field>
        <Field name={proxyCredentialsKey}>
          <FieldLabel>{t('preferences.network.password')}</FieldLabel>
          <Input
            type="password"
            autocomplete="new-password"
            value={entered()?.password ?? ''}
            onValueChange={(value) => edit('password', value)}
          />
        </Field>
      </div>
    </FieldGroup>
  )
}
