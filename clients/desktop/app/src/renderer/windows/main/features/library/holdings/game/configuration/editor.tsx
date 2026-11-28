import { createSignal, For } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@kisaki3/desktop-ui/dialog'
import { Field, FieldLabel, FieldGroup } from '@kisaki3/desktop-ui/field'
import { Input, NumberInput } from '@kisaki3/desktop-ui/input'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import { Select } from '@kisaki3/desktop-ui/select'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { Tabs, TabList, Tab, TabPanel } from '@kisaki3/desktop-ui/tabs'
import { Form, FormFeedback, createForm } from '@kisaki3/desktop-ui/form'
import { dequal } from 'dequal'
import {
  parseGameLaunchConfigCreate,
  type GameLaunchDefinition,
  type GameLaunchConfig,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../../../infrastructure/api'
import type { EditorGuard } from '../../../../../../../infrastructure/dialogs/closing'
import { reportError } from '../../../../../../../infrastructure/notifications'

export function ConfigEditor(props: {
  api: MainClient
  game: string
  saved?: GameLaunchConfig
  close: () => void
  done: () => void
  register: (v: EditorGuard) => void
}) {
  const { api, saved } = props,
    t = api.t
  const initial: GameLaunchDefinition =
    saved?.definition.status === 'ready'
      ? saved.definition.value
      : {
          launch: { type: 'file', path: null },
          monitor: { type: 'process', name: null },
          timing: 'foreground',
          savePath: null,
          autoBackupEnabled: false,
          backupRetentionCount: null,
        }
  const [name, setName] = createSignal(saved?.name ?? ''),
    [note, setNote] = createSignal(saved?.note ?? ''),
    [definition, setDefinition] = createSignal(initial),
    [tab, setTab] = createSignal('launch')
  const update = (values: Partial<GameLaunchDefinition>) =>
    setDefinition((v) => ({ ...v, ...values }))
  const dirty = () =>
    name() !== (saved?.name ?? '') ||
    note() !== (saved?.note ?? '') ||
    !dequal(definition(), initial)
  const options = {
    emptyMessage: t('controls.search.empty'),
    invalidSelectionMessage: t('controls.feedback.unavailable'),
  }
  const form = createForm({
    validate: () => (name().trim() ? [] : [{ id: 'name', summary: t('forms.enterName') }]),
    onSubmit: async () => {
      const value = parseGameLaunchConfigCreate({
        name: name().trim(),
        note: note() || null,
        definition: definition(),
      })
      if (saved) {
        const changed = !dequal(initial, value.definition) || saved.definition.status !== 'ready'
        await api.call('library.configs.update', props.game, saved.id, {
          changes: {
            ...(value.name !== saved.name && { name: value.name }),
            ...(value.note !== saved.note && { note: value.note ?? null }),
            ...(changed && { definition: value.definition }),
          },
          expected: {
            ...(value.name !== saved.name && { name: saved.name }),
            ...(value.note !== saved.note && { note: saved.note }),
            ...(changed && saved.definition.status === 'ready' && { definition: initial }),
          },
        })
      } else {
        await api.call('library.configs.create', props.game, value)
      }
      props.done()
    },
  })
  props.register({
    dirty,
    save: form.submit,
    pending: () => (form.busy() ? form.submit() : undefined),
    currentFormAction: () => form.submit,
  })
  function pathField(
    label: string,
    value: string | null,
    kind: 'file' | 'directory',
    change: (v: string | null) => void,
  ) {
    return (
      <Field>
        <FieldLabel>{label}</FieldLabel>
        <div class="flex gap-2">
          <Input class="grow" value={value ?? ''} onValueChange={(v) => change(v || null)} />
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void api
                .call('library.holdings.choosePath', kind)
                .then((v) => {
                  if (v) {
                    change(v)
                  }
                })
                .catch(reportError)
            }
          >
            {t('library.holdings.choose')}
          </Button>
        </div>
      </Field>
    )
  }
  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>{t('library.holdings.configs')}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody class="space-y-4">
          <Field>
            <FieldLabel>{t('library.fields.name')}</FieldLabel>
            <Input autofocus value={name()} onValueChange={setName} />
          </Field>
          <Field>
            <FieldLabel>{t('library.fields.note')}</FieldLabel>
            <Textarea value={note()} onValueChange={setNote} />
          </Field>
          <Tabs value={tab()} onValueChange={setTab}>
            <TabList>
              <For each={['launch', 'monitor', 'save'] as const}>
                {(v) => <Tab value={v}>{t(`library.launchConfig.${v}`)}</Tab>}
              </For>
            </TabList>
            <TabPanel value="launch">
              <FieldGroup>
                <Field>
                  <FieldLabel>{t('library.launchConfig.launch')}</FieldLabel>
                  <Select
                    {...options}
                    value={definition().launch.type}
                    options={(['file', 'url', 'command'] as const).map((value) => ({
                      value,
                      label:
                        value === 'file'
                          ? t('library.holdings.file')
                          : t(`library.launchConfig.${value}`),
                    }))}
                    onValueChange={(v) => {
                      if (v === 'file') {
                        update({ launch: { type: v, path: null } })
                      }
                      if (v === 'url') {
                        update({ launch: { type: v, url: null } })
                      }
                      if (v === 'command') {
                        update({ launch: { type: v, command: null, workingDirectory: null } })
                      }
                    }}
                  />
                </Field>
                {(() => {
                  const launch = definition().launch
                  switch (launch.type) {
                    case 'file':
                      return pathField(
                        t('library.holdings.launchPath'),
                        launch.path,
                        'file',
                        (path) => update({ launch: { type: 'file', path } }),
                      )
                    case 'url':
                      return (
                        <Field>
                          <FieldLabel>{t('library.launchConfig.url')}</FieldLabel>
                          <Input
                            value={launch.url ?? ''}
                            onValueChange={(v) =>
                              update({ launch: { type: 'url', url: v || null } })
                            }
                          />
                        </Field>
                      )
                    case 'command':
                      return (
                        <>
                          <Field>
                            <FieldLabel>{t('library.launchConfig.command')}</FieldLabel>
                            <Input
                              value={launch.command ?? ''}
                              onValueChange={(v) =>
                                update({ launch: { ...launch, command: v || null } })
                              }
                            />
                          </Field>
                          {pathField(
                            t('library.holdings.workingDirectory'),
                            launch.workingDirectory,
                            'directory',
                            (workingDirectory) =>
                              update({ launch: { ...launch, workingDirectory } }),
                          )}
                        </>
                      )
                  }
                })()}
              </FieldGroup>
            </TabPanel>
            <TabPanel value="monitor">
              <FieldGroup>
                <Field>
                  <FieldLabel>{t('library.launchConfig.monitor')}</FieldLabel>
                  <Select
                    {...options}
                    value={definition().monitor.type}
                    options={(['process', 'directory', 'file'] as const).map((value) => ({
                      value,
                      label:
                        value === 'file'
                          ? t('library.holdings.file')
                          : t(`library.launchConfig.${value}`),
                    }))}
                    onValueChange={(v) => {
                      if (v === 'process') {
                        update({ monitor: { type: v, name: null } })
                      }
                      if (v === 'file' || v === 'directory') {
                        update({ monitor: { type: v, path: null } })
                      }
                    }}
                  />
                </Field>
                {(() => {
                  const monitor = definition().monitor
                  return monitor.type === 'process' ? (
                    <Field>
                      <FieldLabel>{t('library.launchConfig.process')}</FieldLabel>
                      <Input
                        value={monitor.name ?? ''}
                        onValueChange={(v) =>
                          update({ monitor: { type: 'process', name: v || null } })
                        }
                      />
                    </Field>
                  ) : (
                    pathField(
                      t('library.holdings.monitorPath'),
                      monitor.path,
                      monitor.type,
                      (path) => update({ monitor: { ...monitor, path } }),
                    )
                  )
                })()}
                <Field>
                  <FieldLabel>{t('library.launchConfig.timing')}</FieldLabel>
                  <Select
                    {...options}
                    value={definition().timing}
                    options={(['foreground', 'running'] as const).map((value) => ({
                      value,
                      label: t(`library.launchConfig.${value}`),
                    }))}
                    onValueChange={(v) => {
                      if (v === 'foreground' || v === 'running') {
                        update({ timing: v })
                      }
                    }}
                  />
                </Field>
              </FieldGroup>
            </TabPanel>
            <TabPanel value="save">
              <FieldGroup>
                {pathField(
                  t('library.holdings.savePath'),
                  definition().savePath,
                  'directory',
                  (savePath) => update({ savePath }),
                )}
                <label class="flex items-center justify-between text-sm">
                  {t('library.launchConfig.autoBackup')}
                  <Switch
                    checked={definition().autoBackupEnabled}
                    onCheckedChange={(autoBackupEnabled) => update({ autoBackupEnabled })}
                  />
                </label>
                <Field>
                  <FieldLabel>{t('library.launchConfig.retention')}</FieldLabel>
                  <NumberInput
                    min={1}
                    step={1}
                    value={definition().backupRetentionCount?.toString() ?? ''}
                    increaseLabel={t('controls.number.increase')}
                    decreaseLabel={t('controls.number.decrease')}
                    onValueChange={(v) =>
                      update({ backupRetentionCount: v === '' ? null : Number(v) })
                    }
                  />
                </Field>
              </FieldGroup>
            </TabPanel>
          </Tabs>
        </DialogBody>
        <DialogFooter>
          <FormFeedback summary={(count) => t('forms.fieldErrors', { count })} />
          <Button variant="ghost" onClick={props.close}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" disabled={form.busy()}>
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </Form>
    </>
  )
}
