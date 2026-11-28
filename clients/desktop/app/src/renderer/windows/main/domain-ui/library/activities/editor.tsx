import { createSignal, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@kisaki3/desktop-ui/dialog'
import { Field, FieldLabel, FieldGroup } from '@kisaki3/desktop-ui/field'
import { NumberInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { Form, FormFeedback, createForm } from '@kisaki3/desktop-ui/form'
import {
  parseActivityCreate,
  parseActivityUpdate,
  type Activity,
  type PartRef,
  type WorkRef,
  type PartQuery,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import type { EditorGuard } from '../../../../../infrastructure/dialogs/closing'
import { libraryRead } from '../read'

export function formatLocal(ms: number) {
  const d = new Date(ms)
  return new Date(ms - d.getTimezoneOffset() * 60000).toISOString().slice(0, 23)
}
export interface ActivityEdit {
  work: WorkRef
  saved?: Activity
}
export function ActivityEditor(props: {
  api: MainClient
  edit: ActivityEdit
  register: (v: EditorGuard) => void
  saved: () => void
  close: () => void
}) {
  const { api, edit } = props,
    t = api.t,
    { work, saved } = edit,
    end = saved?.endedAt ?? Date.now()
  const initial = {
    start: formatLocal(saved?.startedAt ?? end - 3600000),
    end: formatLocal(end),
    duration: (saved?.durationMs ?? 3600000) / 60000,
  }
  const [start, setStart] = createSignal(initial.start),
    [finish, setFinish] = createSignal(initial.end),
    [minutes, setMinutes] = createSignal(String(initial.duration))
  const [config, setConfig] = createSignal<string | null>(null),
    [file, setFile] = createSignal<string | null>(null),
    [part, setPart] = createSignal<PartRef | null>(null)
  const choices = libraryRead(api, ['holdings', 'parts'], async (signal) => {
    type Option = { value: string; label: string }
    const configs: Option[] = [],
      files: Option[] = [],
      parts: { value: string; label: string; ref: PartRef }[] = []
    if (!saved && work.type === 'game') {
      for (const row of await api.request(signal, 'library.configs.list', work.id)) {
        configs.push({ value: row.id, label: row.name })
      }
    }
    if (!saved && work.type !== 'game') {
      const ref = { type: work.type, id: work.id }
      for (let offset = 0; ; offset += 200) {
        const page = await api.request(
          signal,
          'library.files.list',
          ref,
          { search: '' },
          { offset, limit: 200 },
        )
        files.push(...page.items.map((row) => ({ value: row.id, label: row.path })))
        if (offset + page.items.length >= page.total) {
          break
        }
      }
      const kinds = {
        anime: ['animeEpisode', 'animeExtra'],
        comic: ['comicVolume', 'comicChapter'],
        novel: ['novelVolume'],
      } as const
      for (const kind of kinds[work.type]) {
        for (let offset = 0; ; offset += 200) {
          const page = await api.request(
            signal,
            'library.parts.list',
            { work: ref, partType: kind, search: '' } as PartQuery,
            { offset, limit: 200 },
          )
          parts.push(
            ...page.items.map((row) => ({
              value: row.ref.id,
              label:
                row.data.name || ('numberLabel' in row.data && row.data.numberLabel) || row.ref.id,
              ref: row.ref,
            })),
          )
          if (offset + page.items.length >= page.total) {
            break
          }
        }
      }
    }
    return { configs, files, parts }
  })
  const empty = { value: '', label: t('library.holdings.none') },
    opts = {
      emptyMessage: t('controls.search.empty'),
      invalidSelectionMessage: t('controls.feedback.unavailable'),
    }
  const dirty = () =>
    start() !== initial.start ||
    finish() !== initial.end ||
    Number(minutes()) !== initial.duration ||
    !!config() ||
    !!file() ||
    !!part()
  const form = createForm({
    onSubmit: async () => {
      const timing = {
        startedAt: new Date(start()).getTime(),
        endedAt: new Date(finish()).getTime(),
        durationMs: Math.round(Number(minutes()) * 60000),
      }
      if (saved) {
        const { startedAt, endedAt, durationMs, context } = saved
        await api.call(
          'library.activities.update',
          work,
          saved.id,
          parseActivityUpdate(
            work,
            {
              changes: timing,
              expected: { activity: { startedAt, endedAt, durationMs, context } },
            },
            Date.now(),
          ),
        )
      } else {
        const context =
          work.type === 'game' ? { launchConfigId: config() } : { fileId: file(), part: part() }
        await api.call(
          'library.activities.create',
          parseActivityCreate({ work, ...timing, context }, Date.now()),
        )
      }
      props.saved()
    },
  })
  props.register({
    dirty,
    save: form.submit,
    pending: () => (form.busy() ? form.submit() : undefined),
    currentFormAction: () => form.submit,
  })
  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>
          {t(saved ? 'library.records.activity' : 'library.records.addActivity')}
        </DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('library.records.started')}</FieldLabel>
              <input
                class="h-8 rounded-md border border-input bg-background px-2 text-sm"
                type="datetime-local"
                step="0.001"
                value={start()}
                onInput={(e) => setStart(e.currentTarget.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t('library.records.ended')}</FieldLabel>
              <input
                class="h-8 rounded-md border border-input bg-background px-2 text-sm"
                type="datetime-local"
                step="0.001"
                value={finish()}
                onInput={(e) => setFinish(e.currentTarget.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t('library.records.minutes')}</FieldLabel>
              <NumberInput
                min={0}
                step={0.01}
                value={minutes()}
                onValueChange={setMinutes}
                increaseLabel={t('controls.number.increase')}
                decreaseLabel={t('controls.number.decrease')}
              />
            </Field>
            <Show when={!saved}>
              <Show
                when={work.type === 'game'}
                fallback={
                  <>
                    <Field>
                      <FieldLabel>{t('library.holdings.file')}</FieldLabel>
                      <Select
                        {...opts}
                        options={[empty, ...(choices.result()?.value?.files ?? [])]}
                        value={file() ?? ''}
                        onValueChange={(v) => setFile(v || null)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>{t('library.ruleEditor.target')}</FieldLabel>
                      <Select
                        {...opts}
                        options={[empty, ...(choices.result()?.value?.parts ?? [])]}
                        value={part()?.id ?? ''}
                        onValueChange={(v) =>
                          setPart(
                            choices.result()?.value?.parts.find((row) => row.value === v)?.ref ??
                              null,
                          )
                        }
                      />
                    </Field>
                  </>
                }
              >
                <Field>
                  <FieldLabel>{t('library.holdings.configs')}</FieldLabel>
                  <Select
                    {...opts}
                    options={[empty, ...(choices.result()?.value?.configs ?? [])]}
                    value={config() ?? ''}
                    onValueChange={(v) => setConfig(v || null)}
                  />
                </Field>
              </Show>
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
