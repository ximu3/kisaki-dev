import { For, Show } from 'solid-js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { mdiBookshelf } from '@mdi/js'
import {
  workTypes,
  type ActivityStatistics,
  type CompletionStatistics,
  type WorkRef,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../infrastructure/api'
import { LibraryImage } from '../../domain-ui/library/image'

export type WorkLabels = Map<string, { name: string; primaryImageId: string | null }>
export function StatsHero(props: {
  api: MainClient
  activity: ActivityStatistics
  completion: CompletionStatistics
  labels: WorkLabels
  duration: (ms: number) => string
  drill: () => void
  open: (work: WorkRef) => void
}) {
  const { api } = props,
    t = api.t,
    a = () => props.activity
  const top = () => a().works[0],
    title = () => top() && props.labels.get(top()!.work.id)
  const segments = () =>
    workTypes
      .map((type) => ({
        type,
        ms: a().works.reduce((n, row) => n + (row.work.type === type ? row.durationMs : 0), 0),
      }))
      .filter((row) => row.ms > 0)
      .sort((l, r) => r.ms - l.ms)
  const fill = (i: number) =>
    'color-mix(in oklch,var(--primary) ' + [85, 65, 45, 30][i] + '%,var(--muted))'
  const facts = () => [
    [t('library.statistics.sessions'), a().activityCount],
    [t('library.statistics.works'), a().works.length],
    [t('library.statistics.average'), props.duration(a().averageDurationMs ?? 0)],
    [t('library.statistics.longest'), props.duration(a().longestDurationMs ?? 0)],
    [
      t('library.statistics.activeDays'),
      t('library.statistics.dayCount', { count: a().activeDayCount }),
    ],
    [
      t('library.statistics.streak'),
      t('library.statistics.dayCount', { count: a().longestStreakDays }),
    ],
    [t('library.statistics.completions'), props.completion.completionCount],
    ...(a().additionalDurationMs
      ? [[t('library.statistics.additional'), props.duration(a().additionalDurationMs)]]
      : []),
    ...(props.completion.unknownDateCount
      ? [[t('library.statistics.unknown'), props.completion.unknownDateCount]]
      : []),
  ]
  return (
    <div class="flex items-stretch gap-8">
      <div class="flex min-w-0 flex-1 flex-col justify-between gap-y-4">
        <div>
          <p class="text-xs text-muted-foreground">{t('library.statistics.duration')}</p>
          <p class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {props.duration(a().durationMs)}
          </p>
        </div>
        <div class="space-y-1.5">
          <div class="flex h-2 gap-px overflow-hidden rounded-full bg-muted">
            <For each={segments()}>
              {(item, i) => (
                <span
                  style={{ width: (item.ms / a().durationMs) * 100 + '%', background: fill(i()) }}
                />
              )}
            </For>
          </div>
          <div class="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <For each={segments()} fallback={<span>{t('library.detail.noRecords')}</span>}>
              {(item, i) => (
                <span class="inline-flex items-center gap-1">
                  <i class="size-2 rounded-full" style={{ background: fill(i()) }} />
                  {t(`library.types.${item.type}`)}{' '}
                  {new Intl.NumberFormat(api.locale(), {
                    style: 'percent',
                    maximumFractionDigits: 1,
                  }).format(item.ms / a().durationMs)}
                </span>
              )}
            </For>
          </div>
        </div>
        <dl class="flex flex-wrap justify-between gap-x-8 gap-y-3">
          <For each={facts()}>
            {(pair) => (
              <div>
                <dt class="text-xs text-muted-foreground">{pair[0]}</dt>
                <dd class="mt-0.5 text-sm font-medium tabular-nums">
                  <button onClick={props.drill}>{pair[1]}</button>
                </dd>
              </div>
            )}
          </For>
        </dl>
      </div>
      <div class="flex w-[5.375rem] shrink-0 flex-col justify-between gap-y-2">
        <button
          class="grid h-[7.5rem] w-full place-items-center overflow-hidden rounded-md border border-border/40 bg-muted shadow-raised"
          disabled={!top()}
          onClick={() => props.open(top()!.work)}
          aria-label={title()?.name ?? t('library.statistics.top')}
        >
          <Show
            when={title()?.primaryImageId}
            fallback={<Icon path={mdiBookshelf} class="size-6 text-muted-foreground" />}
          >
            {(id) => (
              <LibraryImage
                api={api}
                id={id()}
                alt={title()?.name ?? ''}
                class="size-full object-cover"
              />
            )}
          </Show>
        </button>
        <div class="text-right">
          <p class="text-xs text-muted-foreground">{t('library.statistics.top')}</p>
          <p class="mt-0.5 truncate text-sm font-medium">{title()?.name ?? '—'}</p>
        </div>
      </div>
    </div>
  )
}
