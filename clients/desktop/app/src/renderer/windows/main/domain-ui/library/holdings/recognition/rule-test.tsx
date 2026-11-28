import type {
  FileRecognitionDefinition,
  FileRecognitionResult,
  FileWorkType,
  WorkRef,
} from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Input, SearchInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { createSignal, For, onCleanup, Show } from 'solid-js'
import type { HoldingsWindowApi } from '../../../../../../../shared/window-api/library/holdings'
import type { MainClient } from '../../../../../../infrastructure/api'
import { errorMessage } from '../../../../../../infrastructure/notifications'
import { libraryRead } from '../../read'
import { conditionLabel, ruleSource } from './result'

export function RecognitionTest(props: {
  api: MainClient
  work: WorkRef<FileWorkType>
  definition: () => FileRecognitionDefinition
}) {
  const { api } = props,
    t = api.t
  const [base, setBase] = createSignal(''),
    [path, setPath] = createSignal(''),
    [search, setSearch] = createSignal(''),
    [file, setFile] = createSignal<string>()
  const files = libraryRead(api, ['holdings'], (signal) =>
    api.request(
      signal,
      'library.files.list',
      props.work,
      { search: search() },
      { offset: 0, limit: 100 },
    ),
  )
  const [report, setReport] = createSignal<FileRecognitionResult>(),
    [explanation, setExplanation] =
      createSignal<ReturnType<HoldingsWindowApi['library.profiles.explain']>>()
  const [error, setError] = createSignal<unknown>(),
    [busy, setBusy] = createSignal(false)
  let pending: AbortController | undefined
  onCleanup(() => pending?.abort())
  const parts = libraryRead(api, ['parts'], async (signal) => {
    const value = report()
    if (value?.outcome !== 'matched') {
      return []
    }
    return Promise.all(
      value.parts.map(async (ref) => {
        const row = await api.request(signal, 'library.parts.get', ref)
        const name = row?.data.name
        const number = row && 'numberLabel' in row.data ? row.data.numberLabel : null
        return [t(`library.parts.${ref.type}`), number, name].filter(Boolean).join(' · ')
      }),
    )
  })
  async function test(mode: 'text' | 'file') {
    const controller = new AbortController()
    pending?.abort()
    pending = controller
    setBusy(true)
    setError(undefined)
    setReport(undefined)
    setExplanation(undefined)
    try {
      const definition = props.definition()
      if (mode === 'text') {
        setExplanation(
          await api.request(
            controller.signal,
            'library.profiles.explain',
            props.work.type,
            definition,
            base(),
            path() || null,
          ),
        )
      } else if (file()) {
        setReport(
          await api.request(
            controller.signal,
            'library.files.testRecognition',
            props.work,
            file()!,
            { definition },
          ),
        )
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(() => cause)
      }
    } finally {
      if (pending === controller) {
        pending = undefined
        setBusy(false)
      }
    }
  }
  return (
    <section class="space-y-3 border-t pt-3">
      <h3 class="text-sm font-medium">{t('library.holdings.test')}</h3>
      <div class="grid grid-cols-2 gap-2">
        <Field>
          <FieldLabel>{t('library.holdings.baseName')}</FieldLabel>
          <Input value={base()} onValueChange={setBase} />
        </Field>
        <Field>
          <FieldLabel>{t('library.holdings.path')}</FieldLabel>
          <Input value={path()} onValueChange={setPath} />
        </Field>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={busy() || !base()}
        onClick={() => void test('text')}
      >
        {t('actions.preview')}
      </Button>
      <Field>
        <FieldLabel>{t('library.ruleEditor.registeredTest')}</FieldLabel>
        <SearchInput
          value={search()}
          clearLabel={t('controls.search.clear')}
          aria-label={t('controls.search.label')}
          onValueChange={setSearch}
        />
        <Select
          emptyMessage={t('controls.search.empty')}
          invalidSelectionMessage={t('controls.feedback.unavailable')}
          value={file() ?? ''}
          options={(files.result()?.value?.items ?? []).map((row) => ({
            value: row.id,
            label: row.path,
          }))}
          onValueChange={(v) => setFile(v ?? undefined)}
        />
      </Field>
      <Button
        variant="outline"
        size="sm"
        disabled={busy() || !file()}
        onClick={() => void test('file')}
      >
        {t('library.holdings.rulesTest')}
      </Button>
      <Show when={busy()}>
        <Button variant="ghost" onClick={() => pending?.abort()}>
          {t('actions.cancel')}
        </Button>
      </Show>
      <Show when={error() ?? files.result()?.error}>
        {(cause) => <p role="alert">{errorMessage(cause())}</p>}
      </Show>
      <Show when={explanation()}>
        {(value) => (
          <div role="status" class="space-y-1 text-sm">
            <p>
              {ruleSource(value().source, t)} · {value().input}
            </p>
            <dl>
              <For each={Object.entries(value().captures)}>
                {(pair) => (
                  <>
                    <dt>{pair[0]}</dt>
                    <dd>{pair[1]}</dd>
                  </>
                )}
              </For>
            </dl>
            <For each={value().numbers}>
              {(n) => (
                <p>
                  {t('library.holdings.offset')} {n.offset} · {n.input} → {n.value}
                </p>
              )}
            </For>
            <For each={value().conditions}>{(c) => <p>{conditionLabel(c, t)}</p>}</For>
          </div>
        )}
      </Show>
      <Show when={report()}>
        {(value) => {
          const source = () => {
            const r = value()
            return r.outcome === 'unmatched' ? null : r.source
          }
          return (
            <div role="status" class="space-y-1 text-sm">
              <p>
                {t('library.holdings.source')} ·{' '}
                {(() => {
                  const s = source()
                  if (!s) {
                    return t('library.holdings.none')
                  }
                  return s.type === 'builtin'
                    ? t('library.holdings.builtin')
                    : t(
                        s.type === 'draft' ? 'library.holdings.draft' : 'library.holdings.profile',
                      ) +
                        ' · ' +
                        s.ruleId
                })()}
              </p>
              {(() => {
                const r = value()
                switch (r.outcome) {
                  case 'unmatched':
                    return <p>{t('library.holdings.unmatched')}</p>
                  case 'failed':
                    return <p>{r.error.message}</p>
                  case 'matched':
                    return (
                      <>
                        <p>{t('library.holdings.matched')}</p>
                        <For each={parts.result()?.value}>{(label) => <p>{label}</p>}</For>
                      </>
                    )
                }
              })()}
            </div>
          )
        }}
      </Show>
    </section>
  )
}
