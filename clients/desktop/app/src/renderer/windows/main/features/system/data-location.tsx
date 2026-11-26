import { createSignal, Show } from 'solid-js'
import type { DataLocationState, DataModeChange } from '@kisaki3/desktop-contracts/app'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Select } from '@kisaki3/desktop-ui/select'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { Button } from '@kisaki3/desktop-ui/button'
import { Alert } from '@kisaki3/desktop-ui/alert'
import type { Translate } from '@kisaki3/desktop-localization'

export function DataLocation(props: {
  t: Translate
  value: DataLocationState
  error: string | undefined
  busy: boolean
  apply: (change: DataModeChange) => void
  restart: () => void
}) {
  const { t } = props
  const [target, setTarget] = createSignal<DataModeChange['target']>('existing')
  const portable = () => {
    const item = props.value.portable
    return item.status === 'available' ? item : undefined
  }

  return (
    <>
      <Field>
        <FieldLabel>{t('runtime.data')}</FieldLabel>
        <FieldDescription class="wrap-anywhere">
          <Show when={portable()}>
            <span class="block">
              {t(
                props.value.current.mode === 'portable'
                  ? 'runtime.portableMode'
                  : 'runtime.normalMode',
              )}
            </span>
          </Show>
          <span class="block">{props.value.current.path}</span>
        </FieldDescription>
      </Field>

      <Show when={portable()}>
        {(item) => {
          const nextPortable = () => item().nextMode === 'portable'
          const pending = () => item().nextMode !== props.value.current.mode

          return (
            <>
              <Field orientation="responsive">
                <FieldLabel>{t('runtime.destination')}</FieldLabel>
                <FieldDescription class="wrap-anywhere">
                  {nextPortable() ? props.value.normalPath : item().path}
                </FieldDescription>
                <FieldContent>
                  <Select<DataModeChange['target']>
                    class="w-48 max-w-full"
                    disabled={props.busy}
                    value={target()}
                    options={[
                      { value: 'existing', label: t('runtime.existing') },
                      { value: 'empty', label: t('runtime.emptyDirectory') },
                    ]}
                    emptyMessage={t('runtime.noOptions')}
                    invalidSelectionMessage={t('runtime.unavailable')}
                    onValueChange={(value) => setTarget(value || 'existing')}
                  />
                </FieldContent>
              </Field>

              <Field orientation="responsive">
                <FieldLabel>{t('runtime.portable')}</FieldLabel>
                <FieldContent>
                  <Switch
                    checked={nextPortable()}
                    disabled={props.busy}
                    onCheckedChange={(enable) =>
                      props.apply({ mode: enable ? 'portable' : 'normal', target: target() })
                    }
                  />
                </FieldContent>
              </Field>

              <Show when={pending()}>
                <Field orientation="responsive">
                  <FieldLabel>{t('runtime.useAtStartup')}</FieldLabel>
                  <FieldDescription role="status" class="wrap-anywhere">
                    {nextPortable() ? item().path : props.value.normalPath}
                  </FieldDescription>
                  <FieldContent>
                    <Button variant="outline" disabled={props.busy} onClick={props.restart}>
                      {t('runtime.restartApp')}
                    </Button>
                  </FieldContent>
                </Field>
              </Show>
            </>
          )
        }}
      </Show>
      <Show when={props.error}>
        {(message) => (
          <Alert tone="destructive" role="alert">
            {message()}
          </Alert>
        )}
      </Show>
    </>
  )
}
