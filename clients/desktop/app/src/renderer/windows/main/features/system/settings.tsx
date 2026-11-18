/** @fileoverview Presents system registrations as fields with immediately adopted actions. */

import { createMemo, createResource, createSignal, onCleanup, Show } from 'solid-js'
import type { ProtocolIntegrationState } from '@kisaki3/desktop-contracts/app'
import type { Translate } from '@kisaki3/desktop-localization'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { DialogBody, DialogHeader, DialogTitle, deferDialogUntil } from '@kisaki3/desktop-ui/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@kisaki3/desktop-ui/field'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Button } from '@kisaki3/desktop-ui/button'
import type { MainClient } from '../../../../infrastructure/api'
import { errorMessage } from '../../../../infrastructure/notifications'
import { DataLocation } from './data-location'

/** System operations report errors in the field that owns them. */
type Operation = 'login' | 'protocol' | 'launcher' | 'data'

/** Describes what will open this scheme using the system's observed association. */
function describeLinks(
  t: Translate,
  item: Extract<ProtocolIntegrationState, { status: 'available' }>,
) {
  const { scheme, registered, isDefault } = item
  if (!registered) {
    return t('runtime.linksUnregistered', { scheme })
  }
  if (isDefault === null) {
    return t('runtime.linksDefaultUnknown', { scheme })
  }
  return t(isDefault ? 'runtime.linksOpenInKisaki' : 'runtime.linksOpenInOtherApp', { scheme })
}

/** Reads the real operating-system state before showing the settings and after every write. */
export function SystemSettings(props: { api: MainClient; report: (error: unknown) => void }) {
  const { api } = props
  const [state, { refetch }] = createResource(() => api.call('system.get'))
  const current = createMemo((previous: ReturnType<typeof state>) =>
    state.error ? previous : state(),
  )
  deferDialogUntil(() => !!state.error || !!current())
  const [busy, setBusy] = createSignal(false)
  const [failure, setFailure] = createSignal<{ owner: Operation; text: string }>()

  async function perform(owner: Operation, action: () => Promise<unknown>) {
    setBusy(true)
    setFailure(undefined)
    try {
      await action()
    } catch (cause) {
      setFailure({ owner, text: errorMessage(cause) })
    } finally {
      try {
        await refetch()
      } finally {
        setBusy(false)
      }
    }
  }

  const refresh = () => void refetch()
  window.addEventListener('focus', refresh)
  onCleanup(() => window.removeEventListener('focus', refresh))

  function problem(owner: Operation, item: { status: string; error?: { message: string } }) {
    const local = failure()
    return local?.owner === owner ? local.text : item.error?.message
  }

  const login = () => {
    const item = current()?.loginItem
    return item?.status === 'available' ? item : undefined
  }
  const protocol = () => {
    const item = current()?.protocol
    return item?.status === 'available' ? item : undefined
  }
  const launcher = () => {
    const item = current()?.desktopEntry
    return item?.status === 'available' ? item : undefined
  }

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>{api.t('runtime.system')}</DialogTitle>
      </DialogHeader>
      <DialogBody class="grid gap-5">
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

        <Show when={current()}>
          {(snapshot) => (
            <FieldGroup>
              <Show when={snapshot().loginItem.status !== 'unsupported'}>
                <Field orientation="responsive">
                  <FieldLabel>{api.t('runtime.login')}</FieldLabel>
                  <Show when={login()}>
                    {(item) => {
                      const blocked = () =>
                        item().registered &&
                        (item().permission === 'requiresApproval' || item().permission === 'denied')

                      return (
                        <>
                          <Show when={blocked()}>
                            <FieldDescription>
                              {api.t(
                                item().permission === 'denied'
                                  ? 'runtime.startupDisabled'
                                  : 'runtime.startupNeedsApproval',
                              )}
                            </FieldDescription>
                          </Show>
                          <FieldContent>
                            <Show when={blocked() && item().settingsAvailable}>
                              <Button
                                variant="outline"
                                disabled={busy()}
                                onClick={() =>
                                  void perform('login', () =>
                                    api.call('system.settings', 'loginItem'),
                                  )
                                }
                              >
                                {api.t('runtime.startupSettings')}
                              </Button>
                            </Show>
                            <Switch
                              checked={item().registered}
                              disabled={busy()}
                              onCheckedChange={(enable) =>
                                void perform('login', () => api.call('system.login', enable))
                              }
                            />
                          </FieldContent>
                        </>
                      )
                    }}
                  </Show>
                  <IntegrationError message={problem('login', snapshot().loginItem)} />
                </Field>
              </Show>

              <Show when={snapshot().desktopEntry.status !== 'notApplicable'}>
                <Field orientation="responsive">
                  <FieldLabel>{api.t('runtime.desktopEntry')}</FieldLabel>
                  <Show when={launcher()}>
                    {(item) => (
                      <>
                        <FieldDescription>
                          {api.t(
                            item().registered
                              ? 'runtime.desktopEntryReady'
                              : 'runtime.desktopEntryAvailable',
                          )}
                        </FieldDescription>
                        <Show when={!item().registered}>
                          <FieldContent>
                            <Button
                              variant="outline"
                              disabled={busy()}
                              onClick={() =>
                                void perform('launcher', () => api.call('system.desktopEntry'))
                              }
                            >
                              {api.t('runtime.addDesktopEntry')}
                            </Button>
                          </FieldContent>
                        </Show>
                      </>
                    )}
                  </Show>
                  <IntegrationError message={problem('launcher', snapshot().desktopEntry)} />
                </Field>
              </Show>

              <Field role="group" aria-label={api.t('runtime.protocol')} orientation="responsive">
                <FieldLabel>{api.t('runtime.protocol')}</FieldLabel>
                <Show when={protocol()}>
                  {(item) => {
                    const useSettings = () => item().registered && item().settingsAvailable
                    const label = () => {
                      if (!item().registered) {
                        return api.t('runtime.register')
                      }
                      return api.t(
                        useSettings() ? 'runtime.defaultAppSettings' : 'runtime.makeDefaultApp',
                      )
                    }

                    function setHandler() {
                      void perform('protocol', () =>
                        useSettings()
                          ? api.call('system.settings', 'protocol')
                          : api.call('system.protocol'),
                      )
                    }

                    return (
                      <>
                        <FieldDescription>{describeLinks(api.t, item())}</FieldDescription>
                        <Show when={!item().registered || item().isDefault !== true}>
                          <FieldContent>
                            <Button variant="outline" disabled={busy()} onClick={setHandler}>
                              {label()}
                            </Button>
                          </FieldContent>
                        </Show>
                      </>
                    )
                  }}
                </Show>
                <IntegrationError message={problem('protocol', snapshot().protocol)} />
              </Field>
              <DataLocation
                api={api}
                value={snapshot().dataLocation}
                error={problem('data', snapshot().dataLocation.portable)}
                busy={busy()}
                apply={(input) => void perform('data', () => api.call('system.portable', input))}
                restart={() => void api.call('app.restart').catch(props.report)}
              />
            </FieldGroup>
          )}
        </Show>
      </DialogBody>
    </>
  )
}

/** Displays the operation error below the corresponding setting. */
function IntegrationError(props: { message?: string | undefined }) {
  return (
    <Show when={props.message}>
      {(message) => (
        <Alert tone="destructive" role="alert" class="col-span-full">
          {message()}
        </Alert>
      )}
    </Show>
  )
}
