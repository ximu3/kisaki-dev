import type { WorkRef } from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@kisaki3/desktop-ui/menu'
import { mdiFolderOpenOutline } from '@mdi/js'
import { For, Show } from 'solid-js'
import type { MainClient } from '../../../../../../infrastructure/api'
import { reportError } from '../../../../../../infrastructure/notifications'
import { libraryRead } from '../../read'

export function DirectoryMenu(props: { api: MainClient; work: WorkRef }) {
  const { api } = props,
    t = api.t
  const read = libraryRead(api, ['holdings'], (signal) =>
    api.request(signal, 'library.holdings.directories', props.work),
  )
  const dirs = () => read.result()?.value ?? []
  const open = (id: string) =>
    void api.call('library.holdings.openDirectory', props.work, id).catch(reportError)
  return (
    <Show
      when={dirs().length > 1}
      fallback={
        <Button
          size="icon-sm"
          variant="secondary"
          disabled={!dirs().length}
          aria-label={t('library.holdings.open')}
          title={dirs()[0]?.path ?? t('library.holdings.title')}
          onClick={() => open(dirs()[0]!.id)}
        >
          <Icon path={mdiFolderOpenOutline} />
        </Button>
      }
    >
      <Menu>
        <MenuTrigger
          size="icon-sm"
          variant="secondary"
          aria-label={t('library.holdings.title')}
          title={t('library.holdings.title')}
        >
          <Icon path={mdiFolderOpenOutline} />
        </MenuTrigger>
        <MenuContent placement="bottom-end">
          <For each={dirs()}>
            {(dir) => <MenuItem onSelect={() => open(dir.id)}>{dir.path}</MenuItem>}
          </For>
        </MenuContent>
      </Menu>
    </Show>
  )
}
