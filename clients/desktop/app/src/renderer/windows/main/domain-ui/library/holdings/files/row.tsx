import type { HeldFile, PartRef } from '@kisaki3/desktop-contracts/library'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@kisaki3/desktop-ui/menu'
import { mdiDotsHorizontal, mdiFileOutline } from '@mdi/js'
import { Show } from 'solid-js'
import type { MainClient } from '../../../../../../infrastructure/api'
import { reportError } from '../../../../../../infrastructure/notifications'

export function FileRow(props: {
  api: MainClient
  file: HeldFile
  part?: PartRef | undefined
  selected: boolean
  toggle: (on: boolean) => void
  edit: (type: 'details' | 'parts') => void
  settings: () => void
  tracks: (file: HeldFile<'anime'>) => void
  test: () => void
  relocate: () => void
  remove: () => void
}) {
  const { api } = props,
    t = api.t,
    work = props.file.work
  return (
    <div class="flex items-center gap-2 px-3 py-2.5">
      <Checkbox
        checked={props.selected}
        aria-label={props.file.path}
        onCheckedChange={props.toggle}
      />
      <Icon path={mdiFileOutline} class="size-4 shrink-0 text-muted-foreground" />
      <button class="min-w-0 grow text-start" onClick={() => props.edit('details')}>
        <span class="block truncate text-sm font-medium" title={props.file.path}>
          {props.file.path.split(/[\\/]/u).at(-1)}
        </span>
        <span class="block truncate text-xs text-muted-foreground">
          {props.file.path} ·{' '}
          {t(
            (
              {
                accessible: 'library.holdings.available',
                unavailable: 'library.holdings.missing',
                unchecked: 'library.holdings.unknown',
              } as const
            )[props.file.availability.status],
          )}
        </span>
      </button>
      <Menu>
        <MenuTrigger
          size="icon-sm"
          variant="ghost"
          aria-label={t('actions.more') + ' · ' + props.file.path}
        >
          <Icon path={mdiDotsHorizontal} />
        </MenuTrigger>
        <MenuContent placement="bottom-end">
          <MenuItem onSelect={() => props.settings()}>
            {t('library.localSettings.fromFile')}
          </MenuItem>
          <Show when={'playbackChoices' in props.file && props.file}>
            {(video) => (
              <MenuItem onSelect={() => props.tracks(video())}>
                {t('library.localSettings.choices')}
              </MenuItem>
            )}
          </Show>
          <MenuItem onSelect={() => props.edit('details')}>
            {t('library.holdings.fileDetails')}
          </MenuItem>
          <MenuItem onSelect={() => props.edit('parts')}>
            {t('library.holdings.editParts')}
          </MenuItem>
          <MenuItem
            onSelect={() =>
              void api
                .call('library.files.setPreferred', work, {
                  scope: props.part ? { type: 'part', part: props.part } : { type: 'work' },
                  fileId: (
                    props.part
                      ? props.file.associations.find((a) => a.part.id === props.part?.id)
                          ?.isPreferred
                      : props.file.isPreferred
                  )
                    ? null
                    : props.file.id,
                })
                .catch(reportError)
            }
          >
            {t('library.holdings.prefer')}
            {(
              props.part
                ? props.file.associations.find((a) => a.part.id === props.part?.id)?.isPreferred
                : props.file.isPreferred
            )
              ? ' ✓'
              : ''}
          </MenuItem>
          <Show when={props.file.associationMode}>
            {(mode) => (
              <MenuItem
                onSelect={() =>
                  void api
                    .call(
                      'library.files.setMode',
                      work,
                      props.file.id,
                      mode() === 'automatic' ? 'manual' : 'automatic',
                      mode(),
                    )
                    .catch(reportError)
                }
              >
                {t(
                  mode() === 'automatic' ? 'library.holdings.manual' : 'library.holdings.automatic',
                )}
              </MenuItem>
            )}
          </Show>
          <MenuItem onSelect={props.test}>{t('library.holdings.rulesTest')}</MenuItem>
          <MenuItem onSelect={props.relocate}>{t('library.holdings.moveFile')}</MenuItem>
          <MenuItem
            onSelect={() =>
              void api.call('library.files.reveal', work, props.file.id).catch(reportError)
            }
          >
            {t('library.holdings.reveal')}
          </MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={props.remove}>{t('library.holdings.remove')}</MenuItem>
        </MenuContent>
      </Menu>
    </div>
  )
}
