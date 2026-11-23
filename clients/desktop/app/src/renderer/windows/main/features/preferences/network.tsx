/** @fileoverview Edits proxy settings and displays adoption state from the main process. */

import { onCleanup, Show } from 'solid-js'
import { createQuery } from '../../../../infrastructure/query'
import type { ProxyCredentials } from '@kisaki3/desktop-contracts/network'
import type { Translate } from '@kisaki3/desktop-localization'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Button } from '@kisaki3/desktop-ui/button'
import { Field, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Input } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { errorMessage } from '../../../../infrastructure/notifications'
import type { MainClient } from '../../../../infrastructure/api'
import type { PreferenceDraft, PreferenceFields } from './draft'
import { focusPreferenceValue, PreferenceField } from './field'

/** Draft identity shared by the authentication field and the separate editor. */
export const proxyCredentialsKey = 'network.credentials'

/** Edits the manual route and its protected credentials in the shared preference draft. */
export function NetworkFields(props: {
  api: MainClient
  draft: PreferenceDraft
  forceDetails: boolean
  clearDetails: () => void
  configureCredentials: () => void
}) {
  const { api, draft } = props
  const state = createQuery((signal) => api.request(signal, 'network.state'))
  const refresh = () => void state.reload()
  api.topics.addEventListener('network.changed', refresh)
  onCleanup(() => api.topics.removeEventListener('network.changed', refresh))

  const adoption = () => (state.error ? undefined : state.value)
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
        <PreferenceField field="network.mode" label={api.t('runtime.networkMode')}>
          <Select
            value={mode()}
            options={(['system', 'direct', 'manual'] as const).map((value) => ({
              value,
              label: api.t(`runtime.choices.${value}`),
            }))}
            emptyMessage={api.t('runtime.noOptions')}
            invalidSelectionMessage={api.t('runtime.unavailable')}
            onValueChange={(value) => {
              if (value) {
                draft.write('network.mode', value)
                props.clearDetails()
              }
            }}
          />
        </PreferenceField>
        <Show when={mode() === 'manual' || props.forceDetails}>
          <PreferenceField field="network.endpoint" wide label={api.t('runtime.fields.endpoint')}>
            <Input
              placeholder="http://proxy.example:8080"
              value={endpoint()}
              onValueChange={(value) => draft.write('network.endpoint', value || null)}
            />
          </PreferenceField>
          <PreferenceField
            field="network.bypassRules"
            wide
            label={api.t('runtime.fields.bypassRules')}
            description={api.t('runtime.bypassRulesDescription')}
          >
            <Input
              placeholder="*.example.com, 192.0.2.10"
              value={draft.read('network.bypassRules') ?? ''}
              onValueChange={(value) => draft.write('network.bypassRules', value)}
            />
          </PreferenceField>
          <PreferenceField
            field={proxyCredentialsKey}
            label={api.t('runtime.fields.credentials')}
            valueClass="w-fit"
          >
            <Show when={draft.read(proxyCredentialsKey)}>
              <Button variant="outline" onClick={removeCredentials}>
                {api.t('runtime.remove')}
              </Button>
            </Show>
            <Button
              variant="outline"
              aria-haspopup="dialog"
              data-focus-anchor
              disabled={endpoint().toLowerCase().startsWith('socks5:')}
              onClick={props.configureCredentials}
            >
              {api.t('actions.configure')}
            </Button>
          </PreferenceField>
        </Show>
      </FieldGroup>

      <Show when={state.error}>
        {(cause) => (
          <Alert tone="destructive" role="alert">
            {errorMessage(cause())}{' '}
            <Button variant="outline" onClick={refresh}>
              {api.t('runtime.retry')}
            </Button>
          </Alert>
        )}
      </Show>
      <Show when={adoption()?.status === 'applying'}>
        <p role="status" class="m-0 text-sm text-muted-foreground">
          {api.t('runtime.networkApplying')}
        </p>
      </Show>
      <Show when={failure()}>
        {(error) => (
          <Alert tone="destructive" role="alert">
            <strong>{api.t('runtime.networkFailed')}</strong>
            <div>{error().message}</div>
          </Alert>
        )}
      </Show>
    </div>
  )
}

/** Edits the protected pair as one value in the staged credential dialog. */
export function ProxyCredentialFields(props: { t: Translate; draft: PreferenceFields }) {
  const { t, draft } = props
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
          <FieldLabel>{t('runtime.username')}</FieldLabel>
          <Input
            autofocus
            autocomplete="off"
            value={entered()?.username ?? ''}
            onValueChange={(value) => edit('username', value)}
          />
        </Field>
        <Field name={proxyCredentialsKey}>
          <FieldLabel>{t('runtime.password')}</FieldLabel>
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
