import { createSignal, For, Show } from 'solid-js'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@kisaki3/desktop-ui/dialog'
import { Button } from '@kisaki3/desktop-ui/button'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import type {
  ContentDirectory,
  DirectoryRelocationInput,
  HoldingsRelocationResult,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../../infrastructure/api'
import { errorMessage } from '../../../../../../infrastructure/notifications'
import { libraryRead } from '../../../../domain-ui/library/read'

type ConfigField = 'launchPath' | 'workingDirectory' | 'monitorPath' | 'savePath'
interface Choice {
  id: string
  key: ConfigField | 'subtitle'
  path: string
  label: string
}
export function RelocateDirectory(props: {
  api: MainClient
  dir: ContentDirectory
  close: () => void
}) {
  const { api, dir } = props,
    t = api.t
  const [path, setPath] = createSignal(''),
    [selected, setSelected] = createSignal(new Set<string>())
  const [report, setReport] = createSignal<HoldingsRelocationResult>(),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal<unknown>()
  const choices = libraryRead(api, ['holdings'], async (signal) => {
    const items: Choice[] = []
    if (dir.work.type === 'game') {
      for (const config of await api.request(signal, 'library.configs.list', dir.work.id)) {
        if (config.definition.status !== 'ready') {
          continue
        }
        const def = config.definition.value
        function add(key: ConfigField, path: string | null) {
          if (path) {
            items.push({
              id: config.id,
              key,
              path,
              label: config.name + ' · ' + t(`library.holdings.${key}`),
            })
          }
        }
        if (def.launch.type === 'file') {
          add('launchPath', def.launch.path)
        }
        if (def.launch.type === 'command') {
          add('workingDirectory', def.launch.workingDirectory)
        }
        if (def.monitor.type !== 'process') {
          add('monitorPath', def.monitor.path)
        }
        add('savePath', def.savePath)
      }
    } else if (dir.work.type === 'anime') {
      for (let offset = 0; ; offset += 200) {
        const result = await api.request(
          signal,
          'library.files.list',
          { type: 'anime', id: dir.work.id },
          { search: '' },
          { offset, limit: 200 },
        )
        for (const file of result.items) {
          if (!('playbackChoices' in file) || file.playbackChoices.status !== 'ready') {
            continue
          }
          const track = file.playbackChoices.value.subtitleTrack
          if (track?.type === 'external') {
            items.push({
              id: file.id,
              key: 'subtitle',
              path: track.path,
              label: file.path + ' · ' + t('library.holdings.subtitle'),
            })
          }
        }
        if (offset + result.items.length >= result.total) {
          break
        }
      }
    }
    return items
  })
  const key = (item: Choice) => JSON.stringify([item.id, item.key, item.path])
  async function locate() {
    const items = (choices.result()?.value ?? []).filter((item) => selected().has(key(item)))
    const fields = new Map<string, [ConfigField, ...ConfigField[]]>()
    for (const item of items) {
      if (item.key === 'subtitle') {
        continue
      }
      const existing = fields.get(item.id)
      if (existing) {
        existing.push(item.key)
      } else {
        fields.set(item.id, [item.key])
      }
    }
    const input = {
      path: path(),
      expected: { path: dir.path },
      ...(dir.work.type === 'game' && {
        gameConfigFields: [...fields].map(([launchConfigId, fields]) => ({
          launchConfigId,
          fields,
        })),
      }),
      ...(dir.work.type === 'anime' && {
        subtitlePaths: items.map((item) => ({ fileId: item.id, paths: [item.path] as [string] })),
      }),
    } as DirectoryRelocationInput
    setBusy(true)
    setError(undefined)
    try {
      setReport(await api.call('library.holdings.relocateDirectory', dir.work, dir.id, input))
    } catch (cause) {
      setError(() => cause)
    } finally {
      setBusy(false)
    }
  }
  async function choose() {
    try {
      const picked = await api.call('library.holdings.choosePath', 'directory')
      if (picked) {
        setPath(picked)
        setReport(undefined)
      }
    } catch (cause) {
      setError(() => cause)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy()) {
          props.close()
        }
      }}
    >
      <DialogContent size="md">
        <DialogHeader closeLabel={t('actions.close')}>
          <DialogTitle>{t('library.holdings.relocate')}</DialogTitle>
        </DialogHeader>
        <DialogBody class="space-y-4">
          <Field>
            <FieldLabel>{t('library.holdings.from')}</FieldLabel>
            <p class="break-all text-sm">{dir.path}</p>
          </Field>
          <Field>
            <FieldLabel>{t('library.holdings.newPath')}</FieldLabel>
            <Button variant="outline" disabled={busy()} onClick={() => void choose()}>
              {path() || t('library.holdings.choose')}
            </Button>
          </Field>
          <For each={choices.result()?.value}>
            {(item) => (
              <label class="flex items-start gap-2 text-sm">
                <Checkbox
                  disabled={busy()}
                  checked={selected().has(key(item))}
                  onCheckedChange={(on) =>
                    setSelected((before) => {
                      const next = new Set(before)
                      if (on) {
                        next.add(key(item))
                      } else {
                        next.delete(key(item))
                      }
                      return next
                    })
                  }
                />
                <span>
                  {item.label}
                  <small class="block break-all text-muted-foreground">{item.path}</small>
                </span>
              </label>
            )}
          </For>
          <Show when={report()}>
            {(result) => (
              <div role="status" class="space-y-3">
                <Show
                  when={result().updated.length}
                  fallback={<p>{t('library.holdings.unchanged')}</p>}
                >
                  <section>
                    <h3 class="font-medium">{t('library.holdings.updated')}</h3>
                    <For each={result().updated}>
                      {(row) => (
                        <p class="break-all text-xs">
                          {row.from} → {row.to}
                        </p>
                      )}
                    </For>
                  </section>
                </Show>
                <Show when={result().issues.length}>
                  <section>
                    <h3 class="font-medium">{t('library.holdings.issues')}</h3>
                    <For each={result().issues}>
                      {(row) => (
                        <p class="break-all text-xs">
                          {row.path} · {row.error.message}
                        </p>
                      )}
                    </For>
                  </section>
                </Show>
              </div>
            )}
          </Show>
          <Show when={error() ?? choices.result()?.error}>
            {(cause) => (
              <p role="alert" class="text-destructive">
                {errorMessage(cause())}
              </p>
            )}
          </Show>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" disabled={busy()} onClick={props.close}>
            {t('actions.close')}
          </Button>
          <Button
            disabled={busy() || !path() || !!report()?.updated.length}
            onClick={() => void locate()}
          >
            {t('library.holdings.relocate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
