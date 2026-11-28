import { Show } from 'solid-js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  mdiPencilOutline,
  mdiCalendarClockOutline,
  mdiTimerOutline,
  mdiDecagramOutline,
  mdiBookmarkOutline,
} from '@mdi/js'
import type { EntryDetails, WorkType } from '@kisaki3/desktop-contracts/library'
import type { JSX } from '@solidjs/web'
import type { MainClient } from '../../../../../infrastructure/api'
import { LibraryImage } from '../../../domain-ui/library/image'
import { catalogIcon } from '../../../domain-ui/library/icons'
import type { EditField } from '../../../domain-ui/library/entry-editor/model'

function EditableTitle(props: { label: string; action: () => void; children: JSX.Element }) {
  return (
    <div class="group flex min-w-0 items-center gap-3">
      {props.children}
      <Button
        size="icon-xs"
        variant="ghost"
        class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={props.label}
        onClick={props.action}
      >
        <Icon class="size-3" path={mdiPencilOutline} />
      </Button>
    </div>
  )
}
function Fact(props: {
  icon: string
  label: string
  value: string
  editLabel?: string
  edit?: () => void
}) {
  return (
    <div class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 text-xs">
      <dt class="flex items-center gap-1.5 text-muted-foreground">
        <Show when={props.edit} fallback={<Icon path={props.icon} class="size-4" />}>
          {(edit) => (
            <button
              type="button"
              class="group relative size-4"
              aria-label={props.editLabel}
              title={props.editLabel}
              onClick={() => edit()()}
            >
              <Icon
                path={props.icon}
                class="absolute inset-0 size-4 group-hover:opacity-0 group-focus-visible:opacity-0"
              />
              <Icon
                path={mdiPencilOutline}
                class="absolute inset-0 size-4 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            </button>
          )}
        </Show>
        {props.label}
      </dt>
      <dd class="truncate font-medium">{props.value}</dd>
    </div>
  )
}
const recentLabel = {
  game: 'library.fields.lastPlayed',
  anime: 'library.fields.lastWatched',
  comic: 'library.fields.lastRead',
  novel: 'library.fields.lastRead',
} as const
const timeLabel = {
  game: 'library.fields.gameTime',
  anime: 'library.fields.animeTime',
  comic: 'library.fields.readTime',
  novel: 'library.fields.readTime',
} as const

export function EntryHero(props: {
  api: MainClient
  entry: EntryDetails
  edit: (field: EditField) => void
  activity: () => void
  status: () => void
}) {
  const { api } = props,
    t = api.t
  const work = () => {
    const e = props.entry
    return 'record' in e ? e : undefined
  }
  const rating = () => props.entry.evaluation.rating
  const shape = () => {
    const type = props.entry.type
    if (type === 'organization') {
      return 'w-24 aspect-square'
    }
    if (type === 'person' || type === 'character') {
      return 'w-24 aspect-[3/4]'
    }
    return 'w-28 aspect-[3/4]'
  }
  return (
    <div class="catalog-hero mb-4 flex gap-4">
      <button
        type="button"
        aria-label={t('actions.editItem', { name: t('library.fields.primaryImageId') })}
        class={`catalog-cover relative grid shrink-0 place-items-center self-start overflow-hidden rounded-lg border border-border bg-muted shadow-raised ${shape()}`}
        onClick={() => props.edit('images')}
      >
        <Show
          when={props.entry.primaryImageId}
          fallback={
            <Icon path={catalogIcon[props.entry.type]} class="size-7 text-muted-foreground/50" />
          }
        >
          {(id) => (
            <LibraryImage
              api={api}
              id={id()}
              class={
                props.entry.type === 'organization'
                  ? 'size-full object-contain'
                  : 'size-full object-cover'
              }
              alt={props.entry.name}
            />
          )}
        </Show>
      </button>
      <div class="catalog-hero-text flex min-w-0 grow flex-col justify-between">
        <div>
          <EditableTitle
            label={t('actions.editItem', { name: t('library.fields.name') })}
            action={() => props.edit('name')}
          >
            <h2 class="min-w-0 truncate text-lg font-semibold">{props.entry.name}</h2>
          </EditableTitle>
          <EditableTitle
            label={t('actions.editItem', { name: t('library.fields.originalName') })}
            action={() => props.edit('originalName')}
          >
            <p class="mt-1 min-w-0 truncate text-sm text-muted-foreground">
              {props.entry.originalName ?? props.entry.name}
            </p>
          </EditableTitle>
        </div>
        <dl class="catalog-hero-facts grid gap-x-8 gap-y-1.5">
          <Show when={work()}>
            {(e) => (
              <>
                <Fact
                  icon={mdiCalendarClockOutline}
                  label={t(recentLabel[e().type as WorkType])}
                  value={
                    e().lastActiveAt === null
                      ? '—'
                      : new Intl.DateTimeFormat(api.locale()).format(e().lastActiveAt!)
                  }
                  editLabel={t('library.detail.activity')}
                  edit={props.activity}
                />
                <Fact
                  icon={mdiBookmarkOutline}
                  label={t('library.fields.status')}
                  value={t(`library.status.${e().record.status ?? 'unset'}`)}
                  editLabel={t('library.detail.setStatus')}
                  edit={props.status}
                />
                <Fact
                  icon={mdiTimerOutline}
                  label={t(timeLabel[e().type as WorkType])}
                  value={
                    e().totalDurationMs
                      ? t('library.fields.minutes', {
                          count: Math.round(e().totalDurationMs / 60000),
                        })
                      : '—'
                  }
                  editLabel={t('library.fields.additionalTime')}
                  edit={() => props.edit('additionalTime')}
                />
              </>
            )}
          </Show>
          <Fact
            icon={mdiDecagramOutline}
            label={t('library.fields.rating')}
            value={rating() === null ? '—' : String(rating()! / 10)}
            editLabel={t('actions.editItem', { name: t('library.fields.rating') })}
            edit={() => props.edit('rating')}
          />
        </dl>
      </div>
    </div>
  )
}
