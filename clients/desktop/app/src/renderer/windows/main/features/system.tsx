/** @fileoverview Shows observed system registrations and commits explicit changes outside preference drafts. */

import { createResource, createSignal, onCleanup, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import type { MainClient } from '../../../infrastructure/api'
import type { DataModeChange } from '@kisaki3/desktop-contracts/app'

/** System integration panel with independent registration and next-start data-location controls. */
export function SystemSettings(props: { api: MainClient; report: (error: unknown) => void }) {
  const { api } = props
  /** Actual OS permission, handler and data-root state, reread after an action or return from system settings. */
  const [state, { refetch }] = createResource(() => api.call('system.get'))
  /** Explicit choice between using a previous library and preparing an empty target. */
  const [target, setTarget] = createSignal<DataModeChange['target']>('existing')
  /** Serializes user actions that affect the same registration or marker. */
  const [busy, setBusy] = createSignal(false)

  /** Rechecks the actual state even when an operation fails after submitting a system request. */
  async function perform(action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      props.report(error)
    } finally {
      await refetch()
      setBusy(false)
    }
  }
  /** Refreshes any permission the user changed in the external settings application. */
  const refresh = () => void refetch()
  window.addEventListener('focus', refresh)
  onCleanup(() => window.removeEventListener('focus', refresh))

  /** Selects supported login-item controls independently from the permission to launch. */
  const login = () => {
    const value = state()?.loginItem
    return value?.status === 'available' ? value : undefined
  }
  /** Selects handler state without interpreting an unknown OS default as a negative result. */
  const handler = () => {
    const value = state()?.protocol
    return value?.status === 'available' ? value : undefined
  }
  /** Selects a Linux desktop entry only when it applies to this carrier. */
  const launcher = () => {
    const value = state()?.desktopEntry
    return value?.status === 'available' ? value : undefined
  }
  /** Selects this movable carrier's current marker and fixed portable path. */
  const portable = () => {
    const value = state()?.dataLocation.portable
    return value?.status === 'available' ? value : undefined
  }
  /** Collects read failures without hiding other available controls. */
  const issues = () => {
    const value = state()
    return value
      ? [value.loginItem, value.protocol, value.desktopEntry, value.dataLocation.portable].flatMap(
          (v) => (v.status === 'unavailable' ? [v.error.message] : []),
        )
      : []
  }

  return (
    <section class="management">
      <Show when={state()}>
        {(saved) => (
          <>
            <Show when={login()}>
              {(item) => (
                <div class="setting">
                  <label>
                    {api.t('runtime.login')}{' '}
                    <input
                      type="checkbox"
                      disabled={busy()}
                      checked={item().registered}
                      onClick={(event) => {
                        event.preventDefault()
                        void perform(() => api.call('system.login', !item().registered))
                      }}
                    />
                  </label>
                  <Show
                    when={
                      item().permission === 'requiresApproval' || item().permission === 'denied'
                    }
                  >
                    <span>{api.t('runtime.approvalNeeded')}</span>
                  </Show>
                  <Show when={item().settingsAvailable}>
                    <Button
                      variant="outline"
                      onClick={() => void perform(() => api.call('system.settings', 'loginItem'))}
                    >
                      {api.t('runtime.openSettings')}
                    </Button>
                  </Show>
                </div>
              )}
            </Show>
            <div class="setting">
              <span>{api.t('runtime.protocol')}</span>
              <Show when={handler()}>
                {(item) => (
                  <span>
                    {api.t(item().registered ? 'runtime.configured' : 'runtime.none')} ·{' '}
                    {item().isDefault === null
                      ? api.t('runtime.handlerUnknown')
                      : api.t(item().isDefault ? 'runtime.defaultHandler' : 'runtime.otherHandler')}
                  </span>
                )}
              </Show>
              <Button
                variant="outline"
                disabled={busy()}
                onClick={() => void perform(() => api.call('system.protocol'))}
              >
                {api.t('runtime.register')}
              </Button>
            </div>
            <Show when={handler()?.settingsAvailable}>
              <Button
                variant="outline"
                onClick={() => void perform(() => api.call('system.settings', 'protocol'))}
              >
                {api.t('runtime.openSettings')}
              </Button>
            </Show>
            <Show when={launcher()}>
              {(item) => (
                <div class="setting">
                  <span>
                    {api.t('runtime.desktopEntry')} ·{' '}
                    {api.t(item().registered ? 'runtime.configured' : 'runtime.none')}
                  </span>
                  <Button
                    variant="outline"
                    disabled={busy()}
                    onClick={() => void perform(() => api.call('system.desktopEntry'))}
                  >
                    {api.t('runtime.register')}
                  </Button>
                </div>
              )}
            </Show>
            <dl>
              <dt>{api.t('runtime.data')}</dt>
              <dd>{saved().dataLocation.current.path}</dd>
            </dl>
            <Show when={portable()}>
              {(location) => (
                <>
                  <p>
                    {api.t('runtime.normalPath')} {saved().dataLocation.normalPath}
                  </p>
                  <p>
                    {api.t('runtime.portablePath')} {location().path}
                  </p>
                  <label class="setting">
                    {api.t('runtime.destination')}
                    <select
                      value={target()}
                      onChange={(e) => setTarget(e.currentTarget.value as DataModeChange['target'])}
                    >
                      <option value="existing">{api.t('runtime.existing')}</option>
                      <option value="empty">{api.t('runtime.emptyDirectory')}</option>
                    </select>
                  </label>
                  <label class="setting">
                    {api.t('runtime.portable')}
                    <input
                      type="checkbox"
                      checked={location().nextMode === 'portable'}
                      disabled={busy()}
                      onClick={(e) => {
                        e.preventDefault()
                        const mode = location().nextMode === 'portable' ? 'normal' : 'portable'
                        void perform(() => api.call('system.portable', { mode, target: target() }))
                      }}
                    />
                  </label>
                  <Show when={location().nextMode !== saved().dataLocation.current.mode}>
                    <p role="status">{api.t('runtime.restart')}</p>
                    <Button
                      variant="outline"
                      onClick={() => void api.call('app.restart').catch(props.report)}
                    >
                      {api.t('runtime.restartApp')}
                    </Button>
                  </Show>
                </>
              )}
            </Show>
            <Show when={issues().length}>
              <p role="alert">{issues().join(' · ')}</p>
            </Show>
          </>
        )}
      </Show>
    </section>
  )
}
