import type {
  ContentDirectory,
  DirectoryDiscoveryDefinition,
  FileWorkType,
} from '@kisaki3/desktop-contracts/library'
import type { PathFilter } from '@kisaki3/desktop-contracts/paths'
import { Button } from '@kisaki3/desktop-ui/button'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Form, FormFeedback, createForm } from '@kisaki3/desktop-ui/form'
import { Input, NumberInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { dequal } from 'dequal'
import { For, Show, createSignal, onCleanup } from 'solid-js'
import type { HoldingsWindowApi } from '../../../../../../../shared/window-api/library/holdings'
import type { MainClient } from '../../../../../../infrastructure/api'
import type { EditorGuard } from '../../../../../../infrastructure/dialogs/closing'
import { errorMessage } from '../../../../../../infrastructure/notifications'
import { libraryRead } from '../../read'

export function DirectoryEditor(props: {
  api: MainClient
  dir: ContentDirectory<FileWorkType>
  register: (guard: EditorGuard) => void
  close: () => void
  saved: () => void
  profiles: () => void
}) {
  const { api, dir } = props,
    t = api.t
  const before = dir.definition.status === 'ready' ? dir.definition.value : undefined
  const [definition, setDefinition] = createSignal<DirectoryDiscoveryDefinition>(
    before ?? { maxDepth: null, include: [], exclude: [] },
  )
  const [profile, setProfile] = createSignal(dir.recognitionProfileId)
  const [report, setReport] =
      createSignal<ReturnType<HoldingsWindowApi['library.holdings.previewDirectory']>>(),
    [error, setError] = createSignal<unknown>()
  const [previewing, setPreviewing] = createSignal(false)
  const profiles = libraryRead(api, ['holdings'], (signal) =>
    api.request(signal, 'library.profiles.list', dir.work.type),
  )
  const options = {
    emptyMessage: t('controls.search.empty'),
    invalidSelectionMessage: t('controls.feedback.unavailable'),
  }
  const dirty = () => !dequal(before, definition()) || profile() !== dir.recognitionProfileId
  const form = createForm({
    onSubmit: async () => {
      const changed = !dequal(before, definition()),
        reassigned = profile() !== dir.recognitionProfileId
      await api.call('library.holdings.updateDirectory', dir.work, dir.id, {
        changes: {
          ...(changed && { definition: definition() }),
          ...(reassigned && { recognitionProfileId: profile() }),
        },
        expected: {
          ...(changed && before && { definition: before }),
          ...(reassigned && { recognitionProfileId: dir.recognitionProfileId }),
        },
      })
      props.saved()
    },
  })
  props.register({
    dirty,
    save: form.submit,
    pending: () => (form.busy() ? form.submit() : undefined),
    currentFormAction: () => form.submit,
  })
  function editFilters(field: 'include' | 'exclude', list: readonly PathFilter[]) {
    setDefinition((current) => ({ ...current, [field]: list }))
    setReport(undefined)
  }
  let pending: AbortController | undefined
  onCleanup(() => pending?.abort())
  async function preview() {
    const controller = new AbortController()
    pending?.abort()
    pending = controller
    setPreviewing(true)
    setError(undefined)
    try {
      setReport(
        await api.request(
          controller.signal,
          'library.holdings.previewDirectory',
          dir.work,
          dir.id,
          definition(),
          profile(),
        ),
      )
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(() => cause)
      }
    } finally {
      if (pending === controller) {
        pending = undefined
        setPreviewing(false)
      }
    }
  }
  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>{t('library.holdings.title')}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody>
          <FieldGroup>
            <p class="break-all text-sm">{dir.path}</p>
            <Field>
              <FieldLabel>{t('library.holdings.depth')}</FieldLabel>
              <NumberInput
                min={1}
                step={1}
                placeholder={t('showcase.unlimited')}
                value={definition().maxDepth?.toString() ?? ''}
                increaseLabel={t('controls.number.increase')}
                decreaseLabel={t('controls.number.decrease')}
                onValueChange={(v) => {
                  setDefinition((value) => ({ ...value, maxDepth: v === '' ? null : Number(v) }))
                  setReport(undefined)
                }}
              />
            </Field>
            <Field>
              <FieldLabel>{t('library.holdings.profile')}</FieldLabel>
              <div class="flex gap-2">
                <Select
                  {...options}
                  value={profile() ?? 'builtin'}
                  options={[
                    { value: 'builtin', label: t('library.holdings.builtin') },
                    ...(profiles.result()?.value ?? []).map((row) => ({
                      value: row.id,
                      label: row.name,
                    })),
                  ]}
                  onValueChange={(v) => {
                    if (v) {
                      setProfile(v === 'builtin' ? null : v)
                      setReport(undefined)
                    }
                  }}
                />
                <Button variant="outline" onClick={props.profiles}>
                  {t('actions.manage')}
                </Button>
              </div>
            </Field>
            <For each={['include', 'exclude'] as const}>
              {(field) => (
                <Field>
                  <FieldLabel>{t(`library.holdings.${field}`)}</FieldLabel>
                  <For each={definition()[field].map((_, i) => i)}>
                    {(i) => {
                      const row = () => definition()[field][i]!,
                        change = (value: PathFilter) =>
                          editFilters(
                            field,
                            definition()[field].map((item, index) => (index === i ? value : item)),
                          )
                      return (
                        <div class="flex flex-wrap items-center gap-2">
                          <Select
                            {...options}
                            value={row().kind}
                            options={[
                              { value: 'path', label: t('library.holdings.exact') },
                              { value: 'glob', label: t('library.holdings.glob') },
                            ]}
                            onValueChange={(v) => {
                              if (v === 'path') {
                                change({ kind: 'path', path: '' })
                              }
                              if (v === 'glob') {
                                change({ kind: 'glob', pattern: '', ignoreCase: false })
                              }
                            }}
                          />
                          <Input
                            class="min-w-0 grow"
                            value={(() => {
                              const item = row()
                              return item.kind === 'path' ? item.path : item.pattern
                            })()}
                            aria-label={t('library.holdings.path')}
                            onValueChange={(value) => {
                              const item = row()
                              change(
                                item.kind === 'path'
                                  ? { ...item, path: value }
                                  : { ...item, pattern: value },
                              )
                            }}
                          />
                          <Show
                            when={
                              row().kind === 'glob' &&
                              (row() as Extract<PathFilter, { kind: 'glob' }>)
                            }
                          >
                            {(item) => (
                              <label class="flex items-center gap-1 text-xs">
                                <Checkbox
                                  checked={item().ignoreCase}
                                  onCheckedChange={(on) => change({ ...item(), ignoreCase: on })}
                                />
                                {t('library.holdings.ignoreCase')}
                              </label>
                            )}
                          </Show>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              editFilters(
                                field,
                                definition()[field].filter((_, index) => index !== i),
                              )
                            }
                          >
                            {t('actions.remove')}
                          </Button>
                        </div>
                      )
                    }}
                  </For>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      editFilters(field, [...definition()[field], { kind: 'path', path: '' }])
                    }
                  >
                    {t('actions.create')}
                  </Button>
                </Field>
              )}
            </For>
            <Button variant="outline" disabled={previewing()} onClick={() => void preview()}>
              {t('library.holdings.preview')}
            </Button>
            <Show when={previewing()}>
              <Button variant="ghost" onClick={() => pending?.abort()}>
                {t('actions.cancel')}
              </Button>
            </Show>
            <Show when={error()}>{(cause) => <p role="alert">{errorMessage(cause())}</p>}</Show>
            <Show when={report()}>
              {(result) => (
                <div role="status" class="space-y-2">
                  <h3>
                    {t('library.holdings.found')} · {result().items.length}
                  </h3>
                  <For each={result().items}>
                    {(item) => (
                      <p class="break-all text-xs">
                        {item.path}
                        {item.result?.outcome === 'matched' ? ' · ' + item.result.parts.length : ''}
                        {item.result?.outcome === 'failed' ? ' · ' + item.result.error.message : ''}
                      </p>
                    )}
                  </For>
                  <h3>
                    {t('library.holdings.skipped')} · {result().skipped.length}
                  </h3>
                  <For each={result().skipped}>
                    {(path) => <p class="break-all text-xs">{path}</p>}
                  </For>
                  <For each={result().issues}>
                    {(issue) => (
                      <p class="break-all text-xs">
                        {issue.path} · {issue.error.message}
                      </p>
                    )}
                  </For>
                </div>
              )}
            </Show>
          </FieldGroup>
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
