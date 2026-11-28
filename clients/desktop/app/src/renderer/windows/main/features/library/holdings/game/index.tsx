import { createSignal, For, Show } from 'solid-js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Button } from '@kisaki3/desktop-ui/button'
import { Menu, MenuContent, MenuItem, MenuTrigger, MenuSeparator } from '@kisaki3/desktop-ui/menu'
import { mdiDotsHorizontal, mdiPlus, mdiStarOutline, mdiStar } from '@mdi/js'
import type { GameLaunchConfig } from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../../infrastructure/api'
import { EditorDialog } from '../../../../../../infrastructure/dialogs/editor'
import { createConfirmation } from '../../../../../../infrastructure/dialogs/confirmation'
import { errorMessage, reportError } from '../../../../../../infrastructure/notifications'
import { libraryRead } from '../../../../domain-ui/library/read'
import { ManageDirectories } from '../directories'
import { ConfigEditor } from './editor'

export function GameConfigs(props: { api: MainClient; game: string; initial?: GameLaunchConfig }) {
  const { api } = props,
    t = api.t,
    confirm = createConfirmation(t)
  const list = libraryRead(api, ['holdings'], (signal) =>
      api.request(signal, 'library.configs.list', props.game),
    ),
    [edit, setEdit] = createSignal<{ saved?: GameLaunchConfig } | undefined>(
      props.initial ? { saved: props.initial } : undefined,
    ),
    [report, setReport] = createSignal<readonly string[]>([])
  const launchFor = (row: GameLaunchConfig) =>
    row.definition.status === 'ready' ? row.definition.value.launch : null
  async function register() {
    const path = await api.call('library.holdings.choosePath', 'file')
    if (!path) {
      return
    }
    const result = await api.call(
      'library.holdings.register',
      { type: 'game', id: props.game },
      { type: 'file', path },
    )
    setReport(
      result.issues.map((issue) =>
        issue.code === 'launchConfigIncomplete'
          ? t('library.holdings.incompleteConfig')
          : issue.error.message,
      ),
    )
  }
  async function move(index: number, by: number) {
    const before = (list.result()?.value ?? []).map((row) => row.id),
      next = [...before]
    if (index + by < 0 || index + by >= next.length) {
      return
    }
    ;[next[index], next[index + by]] = [next[index + by]!, next[index]!]
    const [first, ...rest] = next
    if (first) {
      await api.call('library.configs.reorder', props.game, {
        order: [first, ...rest],
        expected: { order: before },
      })
    }
  }
  async function remove(row: GameLaunchConfig) {
    if (
      await confirm.ask(t('actions.deleteItem', { name: row.name }), t('actions.delete'), row.name)
    ) {
      await api.call('library.configs.delete', props.game, row.id)
    }
  }
  return (
    <section class="space-y-3">
      <div class="flex items-center gap-2">
        <h3 class="me-auto font-semibold">{t('library.holdings.configs')}</h3>
        <ManageDirectories api={api} work={{ type: 'game', id: props.game }} />
        <Button variant="outline" size="sm" onClick={() => void register().catch(reportError)}>
          {t('library.launchConfig.addTarget')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEdit({})}>
          <Icon path={mdiPlus} />
          {t('actions.create')}
        </Button>
      </div>
      <For each={report()}>{(issue) => <p role="status">{issue}</p>}</For>
      <Show when={list.result()?.error}>{(e) => <p role="alert">{errorMessage(e())}</p>}</Show>
      <div class="divide-y overflow-hidden rounded-md border">
        <For
          each={list.result()?.value}
          keyed={(row) => row.id}
          fallback={
            <p class="py-8 text-center text-sm text-muted-foreground">
              {t('library.detail.empty')}
            </p>
          }
        >
          {(row, index) => (
            <div class="flex items-center gap-2 px-3 py-2">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('library.holdings.prefer')}
                aria-pressed={row().isPreferred ? 'true' : 'false'}
                onClick={() =>
                  void api
                    .call(
                      'library.configs.prefer',
                      props.game,
                      row().isPreferred ? null : row().id,
                      list.result()?.value?.find((r) => r.isPreferred)?.id ?? null,
                    )
                    .catch(reportError)
                }
              >
                <Icon path={row().isPreferred ? mdiStar : mdiStarOutline} />
              </Button>
              <Button
                class="min-w-0 grow justify-start"
                variant="ghost"
                onClick={() => setEdit({ saved: row() })}
              >
                {row().name}
              </Button>
              <Menu>
                <MenuTrigger
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t('actions.more') + ' · ' + row().name}
                >
                  <Icon path={mdiDotsHorizontal} />
                </MenuTrigger>
                <MenuContent placement="bottom-end">
                  <Show when={launchFor(row())}>
                    {(launch) => (
                      <Show
                        when={
                          launch().type === 'command' ||
                          (launch().type === 'file' &&
                            'path' in launch() &&
                            !!Reflect.get(launch(), 'path'))
                        }
                      >
                        <MenuItem
                          onSelect={() =>
                            void api
                              .call('library.configs.openLocation', props.game, row().id)
                              .catch(reportError)
                          }
                        >
                          {t(
                            launch().type === 'command'
                              ? 'library.holdings.open'
                              : 'library.holdings.reveal',
                          )}
                        </MenuItem>
                      </Show>
                    )}
                  </Show>
                  <MenuItem onSelect={() => setEdit({ saved: row() })}>
                    {t('actions.edit')}
                  </MenuItem>
                  <MenuItem
                    disabled={index() === 0}
                    onSelect={() => void move(index(), -1).catch(reportError)}
                  >
                    {t('actions.moveUp')}
                  </MenuItem>
                  <MenuItem
                    disabled={index() + 1 === (list.result()?.value?.length ?? 0)}
                    onSelect={() => void move(index(), 1).catch(reportError)}
                  >
                    {t('actions.moveDown')}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem onSelect={() => void remove(row()).catch(reportError)}>
                    {t('actions.delete')}
                  </MenuItem>
                </MenuContent>
              </Menu>
            </div>
          )}
        </For>
      </div>
      <EditorDialog edit={edit()} size="md" onClose={() => setEdit(undefined)}>
        {(v, controls) => (
          <ConfigEditor
            api={api}
            game={props.game}
            {...v}
            register={controls.registerEditor}
            close={controls.requestClose}
            done={() => setEdit(undefined)}
          />
        )}
      </EditorDialog>
      <confirm.Content />
    </section>
  )
}
