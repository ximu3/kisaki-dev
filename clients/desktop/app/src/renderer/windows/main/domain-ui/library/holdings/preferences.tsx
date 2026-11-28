import type {
  FileWorkType,
  UsagePreferenceTarget,
  WorkRef,
} from '@kisaki3/desktop-contracts/library'
import {
  parseAnimePlaybackPreferences,
  parsePlaybackOverrideChange,
  parseReadingOverrideChange,
  parseReadingPreferences,
  type PreferenceKey,
  type Preferences,
} from '@kisaki3/desktop-contracts/preferences'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kisaki3/desktop-ui/dialog'
import { createForm, Form, FormFeedback } from '@kisaki3/desktop-ui/form'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { dequal } from 'dequal'
import { createSignal, Show } from 'solid-js'
import type { HoldingsWindowApi } from '../../../../../../shared/window-api/library/holdings'
import type { MainClient } from '../../../../../infrastructure/api'
import type { EditorGuard } from '../../../../../infrastructure/dialogs/closing'
import { EditorDialog } from '../../../../../infrastructure/dialogs/editor'
import { errorMessage } from '../../../../../infrastructure/notifications'
import { createViewQuery } from '../../../../../infrastructure/query'
import { PreferenceFieldsContext } from '../../preferences/field'
import { AnimeUsageFields } from '../../preferences/playback-fields'
import { ReadingFields } from '../../preferences/reading-fields'
import { createPreferenceFields, displayValue } from '../../preferences/values'

type Snapshot = ReturnType<HoldingsWindowApi['library.holdings.preferences']>

type SettingProps = {
  api: MainClient
  work: WorkRef<FileWorkType>
  target: UsagePreferenceTarget
  close: () => void
}

function writePath(root: Record<string, unknown>, path: readonly string[], value: unknown) {
  const [key, ...rest] = path
  if (!key) {
    return
  }
  if (!rest.length) {
    root[key] = value
    return
  }
  const nested = { ...(root[key] as Record<string, unknown>) }
  root[key] = nested
  writePath(nested, rest, value)
}

function readPath(root: object, path: readonly string[]) {
  let value: unknown = root
  for (const key of path) {
    if (!value || typeof value !== 'object') {
      return
    }
    value = Reflect.get(value, key) as unknown
  }
  return value
}

export function SavedSettings(props: SettingProps) {
  const { api } = props,
    t = api.t,
    initial = createViewQuery(async (signal) => {
      const [snapshot, defaults] = await Promise.all([
        api.request(signal, 'library.holdings.preferences', props.work, props.target),
        api.request(signal, 'preferences.defaults'),
      ])
      return { snapshot, defaults }
    })
  return (
    <>
      <Show when={initial.result()?.error}>
        {(error) => (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) {
                props.close()
              }
            }}
          >
            <DialogContent size="md">
              <DialogHeader closeLabel={t('actions.close')}>
                <DialogTitle>{t('library.localSettings.saved')}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <p role="alert">{errorMessage(error())}</p>
              </DialogBody>
            </DialogContent>
          </Dialog>
        )}
      </Show>
      <EditorDialog edit={initial.result()?.value} size="lg" onClose={props.close}>
        {(v, g) => (
          <OverrideForm
            {...props}
            snapshot={v.snapshot}
            defaults={v.defaults}
            register={g.registerEditor}
            cancel={g.requestClose}
          />
        )}
      </EditorDialog>
    </>
  )
}

function OverrideForm(
  props: SettingProps & {
    snapshot: Snapshot
    defaults: Preferences
    register: (g: EditorGuard) => void
    cancel: () => void
  },
) {
  const { api, work, snapshot } = props,
    t = api.t,
    old = snapshot.saved?.status === 'ready' ? snapshot.saved.value : null,
    base = old?.settings ?? snapshot.inherited
  const [enabled, setEnabled] = createSignal(old?.enabled ?? false),
    [edits, setEdits] = createSignal(new Map<PreferenceKey, { input: unknown; value: unknown }>())
  const fields = createPreferenceFields(
    (key) => edits().get(key)?.input ?? displayValue(key, readPath(base, key.split('.').slice(2))),
    (key, edit) =>
      setEdits((before) => {
        const next = new Map(before)
        if (dequal(edit.value, readPath(base, key.split('.').slice(2)))) {
          next.delete(key)
        } else {
          next.set(key, edit)
        }
        return next
      }),
    () => props.defaults,
  )
  const dirty = () => enabled() !== (old?.enabled ?? false) || edits().size > 0
  const form = createForm({
    onSubmit: async () => {
      if (!dirty()) {
        props.close()
        return
      }
      const settings = { ...base } as Record<string, unknown>,
        diff: Record<string, unknown> = {},
        expected: Record<string, unknown> = {}
      for (const [key, edit] of edits()) {
        const path = key.split('.').slice(2)
        writePath(settings, path, edit.value)
        writePath(diff, path, edit.value)
        writePath(expected, path, readPath(base, path))
      }
      const value =
        work.type === 'anime'
          ? parseAnimePlaybackPreferences(settings)
          : parseReadingPreferences(settings)
      const change = old
        ? {
            type: 'update',
            changes: {
              ...(enabled() !== old.enabled && { enabled: enabled() }),
              ...(edits().size > 0 && { settings: diff }),
            },
            expected: {
              ...(enabled() !== old.enabled && { enabled: old.enabled }),
              ...(edits().size > 0 && { settings: expected }),
            },
          }
        : { type: 'initialize', enabled: enabled(), settings: value }
      await api.call(
        'library.holdings.updatePreferences',
        work,
        props.target,
        work.type === 'anime'
          ? parsePlaybackOverrideChange(change)
          : parseReadingOverrideChange(change),
      )
      props.close()
    },
  })
  props.register({
    dirty,
    save: form.submit,
    pending: () => (form.busy() ? form.submit() : undefined),
    currentFormAction: () => form.submit,
  })
  const medium = () => (work.type === 'anime' ? null : work.type)
  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>
          {t(
            props.target.type === 'work'
              ? 'library.localSettings.fromWork'
              : 'library.localSettings.fromFile',
          )}
        </DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody class="space-y-4">
          <Show when={snapshot.saved?.status === 'invalid' && snapshot.saved}>
            {(v) => <p role="alert">{v().error.message}</p>}
          </Show>
          <label class="flex items-center justify-between text-sm">
            {t('library.localSettings.use')}
            <Switch checked={enabled()} onCheckedChange={setEnabled} />
          </label>
          <PreferenceFieldsContext value={{ t, draft: fields }}>
            <Show when={medium()} fallback={<AnimeUsageFields />}>
              {(type) => <ReadingFields api={api} medium={type()} />}
            </Show>
          </PreferenceFieldsContext>
        </DialogBody>
        <DialogFooter>
          <FormFeedback summary={(count) => t('forms.fieldErrors', { count })} />
          <Button variant="ghost" onClick={props.cancel}>
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
