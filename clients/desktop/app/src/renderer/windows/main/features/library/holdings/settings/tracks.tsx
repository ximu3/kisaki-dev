import { createSignal, For, Show } from 'solid-js'
import { dequal } from 'dequal'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@kisaki3/desktop-ui/dialog'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Form, FormFeedback, createForm } from '@kisaki3/desktop-ui/form'
import { Input, NumberInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import type { HeldFile, FilePlaybackChoices } from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../../infrastructure/api'
import type { EditorGuard } from '../../../../../../infrastructure/dialogs/closing'
import { reportError } from '../../../../../../infrastructure/notifications'

export function TracksEditor(props: {
  api: MainClient
  file: HeldFile<'anime'>
  register: (g: EditorGuard) => void
  close: () => void
  saved: () => void
}) {
  const { api, file } = props,
    t = api.t,
    old = file.playbackChoices
  const initial =
    old.status === 'ready'
      ? old.value
      : { audioTrack: null, subtitleTrack: null, audioDelaySeconds: 0, subtitleDelaySeconds: 0 }
  const [value, setValue] = createSignal(initial)
  const field = <K extends keyof FilePlaybackChoices>(k: K, v: FilePlaybackChoices[K]) =>
    setValue((row) => ({ ...row, [k]: v }))
  const dirty = () => !dequal(initial, value())
  const form = createForm({
    onSubmit: async () => {
      const changes = Object.fromEntries(
          Object.entries(value()).filter(([k, v]) => !dequal(v, Reflect.get(initial, k))),
        ),
        expected = Object.fromEntries(Object.keys(changes).map((k) => [k, Reflect.get(initial, k)]))
      await api.call('library.files.playbackChoices', file.work.id, file.id, { changes, expected })
      props.saved()
    },
  })
  props.register({
    dirty,
    save: form.submit,
    pending: () => (form.busy() ? form.submit() : undefined),
    currentFormAction: () => form.submit,
  })
  const number = {
    increaseLabel: t('controls.number.increase'),
    decreaseLabel: t('controls.number.decrease'),
  }
  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>{t('library.localSettings.choices')}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody class="space-y-3">
          <Show when={old.status === 'invalid' && old}>
            {(e) => <p role="alert">{e().error.message}</p>}
          </Show>
          <For each={['audioTrack', 'subtitleTrack'] as const}>
            {(key) => {
              const current = () => value()[key]
              return (
                <div class="space-y-2">
                  <Field>
                    <FieldLabel>{t(`library.localSettings.${key}`)}</FieldLabel>
                    <Select
                      value={current()?.type ?? 'automatic'}
                      emptyMessage={t('controls.search.empty')}
                      invalidSelectionMessage={t('controls.feedback.unavailable')}
                      options={(['automatic', 'embedded', 'external'] as const).map((value) => ({
                        value,
                        label: t(`library.localSettings.${value}`),
                      }))}
                      onValueChange={(v) => {
                        if (v === 'automatic') {
                          field(key, null)
                        }
                        if (v === 'embedded') {
                          field(key, { type: v, index: 0 })
                        }
                        if (v === 'external') {
                          field(key, { type: v, index: 0, path: '' })
                        }
                      }}
                    />
                  </Field>
                  <Show when={current()}>
                    {(track) => (
                      <>
                        <Show
                          when={
                            track().type === 'external' &&
                            (track() as Extract<
                              NonNullable<FilePlaybackChoices['audioTrack']>,
                              { type: 'external' }
                            >)
                          }
                        >
                          {(external) => (
                            <Field>
                              <FieldLabel>{t('library.holdings.path')}</FieldLabel>
                              <div class="flex gap-2">
                                <Input
                                  value={external().path}
                                  onValueChange={(path) => field(key, { ...external(), path })}
                                />
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    void api
                                      .call('library.holdings.choosePath', 'file')
                                      .then((path) => {
                                        if (path) {
                                          field(key, { ...external(), path })
                                        }
                                      })
                                      .catch(reportError)
                                  }
                                >
                                  {t('library.holdings.choose')}
                                </Button>
                              </div>
                            </Field>
                          )}
                        </Show>
                        <Field>
                          <FieldLabel>{t('library.localSettings.index')}</FieldLabel>
                          <NumberInput
                            {...number}
                            min={0}
                            step={1}
                            value={String(track().index)}
                            onValueChange={(v) => field(key, { ...track(), index: Number(v) })}
                          />
                        </Field>
                      </>
                    )}
                  </Show>
                </div>
              )
            }}
          </For>
          <For each={['audioDelaySeconds', 'subtitleDelaySeconds'] as const}>
            {(key) => (
              <Field>
                <FieldLabel>{t(`library.localSettings.${key}`)}</FieldLabel>
                <NumberInput
                  {...number}
                  step={0.05}
                  value={String(value()[key])}
                  onValueChange={(v) => field(key, Number(v))}
                />
              </Field>
            )}
          </For>
        </DialogBody>
        <DialogFooter>
          <FormFeedback summary={(count) => t('forms.fieldErrors', { count })} />
          <Button variant="ghost" onClick={props.close}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" disabled={form.busy() || old.status === 'invalid'}>
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </Form>
    </>
  )
}
