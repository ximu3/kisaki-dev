import {
  workTypes,
  type ActivityQuery,
  type ActivityStatistics,
  type WorkRef,
} from '@kisaki3/desktop-contracts/library'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { mdiFolderOutline } from '@mdi/js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import type { MainClient } from '../../../../infrastructure/api'
import { errorMessage } from '../../../../infrastructure/notifications'
import { browseQuery } from '../../domain-ui/library/entries/query'
import { catalogIcon } from '../../domain-ui/library/icons'
import { LibraryImage } from '../../domain-ui/library/images/image'
import { libraryRead } from '../../domain-ui/library/read'
import type { WorkLabels } from './hero'
import { Segment } from './series'

interface Ranked {
  name: string
  image: string | null
  icon: string
  durationMs: number
  activityCount: number
  open: () => void
}

export function Rankings(props: {
  api: MainClient
  stats: ActivityStatistics
  labels: WorkLabels
  duration: (ms: number) => string
  open: (work: WorkRef) => void
  drill: (query: ActivityQuery, title: string) => void
  query: ActivityQuery
}) {
  const { api } = props,
    t = api.t
  const works = createMemo(() =>
    props.stats.works.map((row) => ({
      ...row,
      name: props.labels.get(row.work.id)?.name ?? row.work.id,
      image: props.labels.get(row.work.id)?.primaryImageId ?? null,
      icon: catalogIcon[row.work.type],
      open: () => props.open(row.work),
    })),
  )
  const groups = libraryRead(api, ['collections', 'activities', 'entries'], async (signal) => {
    const ranked = new Map(props.stats.works.map((row) => [row.work.id, row])),
      rows: Ranked[] = []
    for (let offset = 0; ; offset += 100) {
      const page = await api.request(
        signal,
        'library.collections.list',
        { search: '', sort: { type: 'scope' } },
        { offset, limit: 100 },
      )
      for (const c of page.items) {
        const refs = await api.request(
          signal,
          'library.entries.selectRefs',
          browseQuery({ type: 'collection', id: c.id }, workTypes),
          { type: 'all' },
        )
        const used = refs.flatMap((ref) => {
          const row = ranked.get(ref.id)
          return row ? [row] : []
        })
        if (!used.length) {
          continue
        }
        rows.push({
          name: c.name,
          image: c.primaryImageId,
          icon: mdiFolderOutline,
          durationMs: used.reduce((n, r) => n + r.durationMs, 0),
          activityCount: used.reduce((n, r) => n + r.activityCount, 0),
          open: () =>
            props.drill(
              { ...props.query, scope: { type: 'works', refs: used.map((r) => r.work) } },
              c.name,
            ),
        })
      }
      if (offset + page.items.length >= page.total) {
        break
      }
    }
    return rows
  })
  function Ranking(group: { title: string; rows: readonly Ranked[] }) {
    const [by, setBy] = createSignal<'byTime' | 'byCount'>('byTime'),
      metric = (v: Ranked) => (by() === 'byTime' ? v.durationMs : v.activityCount)
    const items = createMemo(() =>
      [...group.rows].sort((a, b) => metric(b) - metric(a)).slice(0, 10),
    )
    return (
      <section class="min-w-0 space-y-2 p-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-medium text-muted-foreground">{group.title}</h2>
          <Segment
            items={['byTime', 'byCount'] as const}
            value={by()}
            label={(k) => t(`library.statistics.${k}`)}
            change={setBy}
          />
        </div>
        <For
          each={items()}
          fallback={
            <p class="py-5 text-sm text-muted-foreground">{t('library.detail.noRecords')}</p>
          }
        >
          {(row, i) => (
            <button
              class="flex w-full items-center gap-3 border-b border-border/50 py-1.5 text-start text-xs"
              onClick={row.open}
            >
              <span class="w-4 text-end text-muted-foreground">{i() + 1}</span>
              <span class="grid size-7 place-items-center overflow-hidden rounded bg-muted">
                <Show when={row.image} fallback={<Icon class="size-4" path={row.icon} />}>
                  {(id) => (
                    <LibraryImage api={api} id={id()} alt="" class="size-full object-cover" />
                  )}
                </Show>
              </span>
              <span class="min-w-0 grow">
                <span class="block truncate">{row.name}</span>
                <span
                  class="mt-1 block h-1 rounded bg-primary/50"
                  style={{ width: (metric(row) / (metric(items()[0]!) || 1)) * 100 + '%' }}
                />
              </span>
              <span class="tabular-nums">
                {by() === 'byTime' ? props.duration(row.durationMs) : row.activityCount}
              </span>
            </button>
          )}
        </For>
      </section>
    )
  }
  return (
    <div class="grid divide-y divide-border @4xl:grid-cols-2 @4xl:divide-x @4xl:divide-y-0">
      <Ranking title={t('library.statistics.ranking')} rows={works()} />
      <div>
        <Show when={groups.result()?.error}>{(e) => <p role="alert">{errorMessage(e())}</p>}</Show>
        <Ranking title={t('library.statistics.collections')} rows={groups.result()?.value ?? []} />
      </div>
    </div>
  )
}
