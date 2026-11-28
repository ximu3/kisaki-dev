import { createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { StatsHero, type WorkLabels } from './hero'
import { ActivityCharts } from './series'
import { Rankings } from './rankings'
import { catalogIcon } from '../../domain-ui/library/icons'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogFooter,
} from '@kisaki3/desktop-ui/dialog'
import { mdiChartBoxOutline, mdiChevronLeft, mdiChevronRight, mdiViewGridOutline } from '@mdi/js'
import {
  workTypes,
  type WorkRef,
  type WorkType,
  type ActivityQuery,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../infrastructure/api'
import { errorMessage } from '../../../../infrastructure/notifications'
import { PageBar } from '../../domain-ui/library/chrome'
import { libraryRead } from '../../domain-ui/library/read'
import { Activities } from '../library/records/activities'
import { periodRange, shift, dayValue, type Period } from './period'

export function Statistics(props: { api: MainClient; openWork: (ref: WorkRef) => void }) {
  const { api } = props,
    t = api.t
  const [period, setPeriod] = createSignal<Period>('all'),
    [date, setDate] = createSignal(new Date()),
    [types, setTypes] = createSignal<readonly WorkType[]>(workTypes)
  const [drill, setDrill] = createSignal<{ title: string; query: ActivityQuery }>()
  const scope = () => ({ type: 'library' as const, workTypes: types() }),
    range = () => periodRange(date(), period())
  const query = (): ActivityQuery => {
    const r = range()
    return { scope: scope(), ...(r && { range: r }) }
  }
  const stats = libraryRead(api, ['activities', 'entries'], async (signal) => {
    const r = range(),
      q = query()
    const [activity, hours, completion] = await Promise.all([
      api.request(signal, 'library.activities.statistics', { ...q, groupBy: 'day' }),
      api.request(signal, 'library.activities.statistics', { ...q, groupBy: 'hour' }),
      api.request(signal, 'library.completions.statistics', {
        scope: scope(),
        ...(r && {
          completedDate: {
            op: 'absoluteRange',
            bounds: { min: dayValue(new Date(r.from)), max: dayValue(new Date(r.to - 1)) },
          },
        }),
      }),
    ])
    const names: WorkLabels = new Map()
    for (let offset = 0; offset < activity.works.length; offset += 200) {
      for (const item of await api.request(
        signal,
        'library.entries.resolveRefs',
        activity.works.slice(offset, offset + 200).map((row) => row.work),
      )) {
        names.set(item.id, item)
      }
    }
    return { activity, hours, completion, names }
  })
  const duration = (n: number) =>
    new Intl.NumberFormat(api.locale(), {
      style: 'unit',
      unit: n >= 3600000 ? 'hour' : 'minute',
      maximumFractionDigits: 1,
    }).format(n / (n >= 3600000 ? 3600000 : 60000))
  const periodLabel = () => {
    const r = range()
    return r
      ? new Intl.DateTimeFormat(api.locale(), { dateStyle: 'medium' }).formatRange(
          new Date(r.from),
          new Date(r.to - 1),
        )
      : ''
  }
  function nav() {
    return (
      <div class="flex gap-1">
        <For each={['all', 'week', 'month', 'year'] as const}>
          {(key) => (
            <Button
              variant={period() === key ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                setPeriod(key)
                setDate(new Date())
              }}
            >
              {t(`library.statistics.${key}`)}
            </Button>
          )}
        </For>
      </div>
    )
  }
  return (
    <article class="flex h-full min-h-0 flex-col">
      <PageBar
        title={t('library.pages.statistics')}
        icon={mdiChartBoxOutline}
        heading="h1"
        afterTitle={nav()}
      >
        <Show when={range()}>
          {(r) => (
            <div class="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t('actions.previous')}
                onClick={() => setDate((v) => shift(v, period(), -1))}
              >
                <Icon path={mdiChevronLeft} />
              </Button>
              <span class="min-w-24 text-center text-sm">{periodLabel()}</span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t('actions.next')}
                disabled={r().to > Date.now()}
                onClick={() => setDate((v) => shift(v, period(), 1))}
              >
                <Icon path={mdiChevronRight} />
              </Button>
            </div>
          )}
        </Show>
        <div class="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
          <For each={['all', ...workTypes] as const}>
            {(type) => (
              <Button
                size="sm"
                class="h-6 gap-1 px-2 text-xs"
                variant={
                  (
                    type === 'all'
                      ? types().length === 4
                      : types().length === 1 && types()[0] === type
                  )
                    ? 'secondary'
                    : 'ghost'
                }
                onClick={() => setTypes(type === 'all' ? workTypes : [type])}
              >
                <Icon
                  class="size-3"
                  path={type === 'all' ? mdiViewGridOutline : catalogIcon[type]}
                />
                <span class="hidden sm:inline">
                  {type === 'all' ? t('library.statistics.allMedia') : t(`library.types.${type}`)}
                </span>
              </Button>
            )}
          </For>
        </div>
      </PageBar>
      <div class="@container min-h-0 grow divide-y divide-border overflow-auto">
        <Show when={stats.result()?.error}>
          {(e) => (
            <p role="alert" class="p-4">
              {errorMessage(e())}
            </p>
          )}
        </Show>
        <Show when={stats.result()?.value}>
          {(data) => (
            <>
              <section class="p-4">
                <StatsHero
                  api={api}
                  activity={data().activity}
                  completion={data().completion}
                  labels={data().names}
                  duration={duration}
                  drill={() => setDrill({ title: t('library.records.activity'), query: query() })}
                  open={props.openWork}
                />
              </section>
              <ActivityCharts
                api={api}
                days={data().activity.groups}
                hours={data().hours.groups}
                range={range()}
                period={period()}
                drill={(range, title) => setDrill({ title, query: { scope: scope(), range } })}
              />
              <Rankings
                api={api}
                stats={data().activity}
                labels={data().names}
                duration={duration}
                open={props.openWork}
                query={query()}
                drill={(query, title) => setDrill({ query, title })}
              />
            </>
          )}
        </Show>
      </div>
      <Show when={drill()}>
        {(d) => (
          <Dialog
            open
            onOpenChange={(v) => {
              if (!v) {
                setDrill(undefined)
              }
            }}
          >
            <DialogContent size="lg">
              <DialogHeader closeLabel={t('actions.close')}>
                <DialogTitle>{d().title}</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <Activities
                  api={api}
                  query={d().query}
                  openWork={(ref) => {
                    setDrill(undefined)
                    props.openWork(ref)
                  }}
                />
              </DialogBody>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDrill(undefined)}>
                  {t('actions.close')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </Show>
    </article>
  )
}
