import { createSignal, Show, onSettled } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@kisaki3/desktop-ui/dialog'
import { Annotations } from './records/annotations'
import { Notes } from './records/notes'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@kisaki3/desktop-ui/menu'
import { mdiBookshelf, mdiMagnify, mdiArrowLeft, mdiDotsHorizontal } from '@mdi/js'
import {
  entryTypes,
  type EntryRef,
  type ShowcaseFields,
  type ShowcaseQuery,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../infrastructure/api'
import { PageBar } from '../../domain-ui/library/chrome'
import { EntryPicker } from '../../domain-ui/library/picker'
import { browseQuery } from '../../domain-ui/library/query'
import type { CardItem } from '../../domain-ui/library/cards'
import { LibraryPanes } from './pane-width'
import type { LibraryNavigation, LibraryPage, LibraryVisit } from './navigation'
import { LibraryExplorer } from './explorer'
import { Showcase } from './showcase'
import { BrowseEntries } from './browse'
import { Organizers } from './organizers'
import { EntryDetail } from './entry'

export function Library(props: {
  api: MainClient
  navigation: LibraryNavigation
  active: boolean
}) {
  const { api, navigation } = props,
    t = api.t
  const [searching, setSearching] = createSignal(false)
  const [dialog, setDialog] = createSignal<LibraryPage>()
  function openEntry(entry: EntryRef) {
    navigation.open({ kind: 'entry', entry })
  }
  function openCard(item: CardItem, mode: ShowcaseFields['openMode']) {
    const target = item.target
    const page: LibraryPage =
      target.type === 'collection' || target.type === 'tag'
        ? {
            kind: 'entries',
            query: browseQuery({ type: target.type, id: target.id }),
            title: item.name,
          }
        : { kind: 'entry', entry: target }
    if (mode === 'dialog') {
      setDialog(page)
    } else {
      navigation.open(page)
    }
  }
  function all(query: ShowcaseQuery, title: string) {
    switch (query.kind) {
      case 'entry': {
        const { scope, rules, sort, search } = query
        const fields = { scope, rules, sort, search }
        navigation.open({ kind: 'entries', query: fields, title })
        break
      }
      case 'collection': {
        const { search, sort, membershipMode } = query
        navigation.open({
          kind: 'collections',
          query: { search, sort, ...(membershipMode && { membershipMode }) },
        })
        break
      }
      case 'tag': {
        const { search, sort, used } = query
        navigation.open({
          kind: 'tags',
          query: { search, sort, ...(used !== undefined && { used }) },
        })
        break
      }
    }
  }
  function display(page: LibraryPage, open: (next: LibraryPage) => void, visit?: LibraryVisit) {
    switch (page.kind) {
      case 'annotations':
        return (
          <div class="flex h-full flex-col">
            <PageBar title={t('library.pages.annotations')} icon={mdiBookshelf} />
            <div class="min-h-0 grow overflow-auto p-4">
              <Annotations
                receipt={visit?.receipt}
                api={api}
                scope={{ type: 'library' }}
                {...(page.ref && { initial: page.ref })}
              />
            </div>
          </div>
        )
      case 'notes':
        return (
          <div class="flex h-full flex-col">
            <PageBar title={t('library.pages.notes')} icon={mdiBookshelf} />
            <div class="min-h-0 grow overflow-auto p-4">
              <Notes
                receipt={visit?.receipt}
                api={api}
                openEntry={openEntry}
                {...(page.id && { initialId: page.id })}
              />
            </div>
          </div>
        )
      case 'showcase':
        return <Showcase api={api} visit={visit} open={openCard} all={all} />
      case 'entry':
        return (
          <EntryDetail
            visit={visit}
            api={api}
            openOrganizer={(type, id, title) =>
              open({ kind: 'entries', query: browseQuery({ type, id }), title })
            }
            target={page.entry}
            {...(page.location && { location: page.location })}
            open={(entry) => open({ kind: 'entry', entry })}
          />
        )
      case 'entries':
        return (
          <BrowseEntries
            visit={visit}
            api={api}
            title={page.title}
            query={page.query}
            open={(entry) => open({ kind: 'entry', entry })}
          />
        )
      case 'collections':
      case 'tags':
        return (
          <Organizers
            visit={visit}
            api={api}
            kind={page.kind === 'collections' ? 'collection' : 'tag'}
            query={page.query}
            open={(query, title) => open({ kind: 'entries', query, title })}
          />
        )
    }
  }
  onSettled(() => {
    function key(event: KeyboardEvent) {
      if (
        !props.active ||
        event.defaultPrevented ||
        event.isComposing ||
        document.querySelector('dialog:modal')
      ) {
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setSearching(true)
      }
      if (event.altKey && event.key === 'ArrowLeft' && navigation.canGoBack()) {
        event.preventDefault()
        navigation.back()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })
  return (
    <div class="flex h-full min-h-0 flex-col">
      <PageBar title={t('library.pages.library')} icon={mdiBookshelf} heading="h1">
        <Show when={navigation.canGoBack()}>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={t('actions.back')}
            onClick={navigation.back}
          >
            <Icon path={mdiArrowLeft} />
          </Button>
        </Show>
        <Button size="sm" variant="secondary" onClick={() => setSearching(true)}>
          <Icon path={mdiMagnify} class="size-4" />
          {t('library.organize.search')}
          <kbd class="ms-2 font-mono text-xs text-muted-foreground">Ctrl F</kbd>
        </Button>
        <Menu>
          <MenuTrigger
            size="icon-sm"
            variant="ghost"
            aria-label={t('library.pages.library') + ' · ' + t('actions.more')}
          >
            <Icon path={mdiDotsHorizontal} />
          </MenuTrigger>
          <MenuContent placement="bottom-end">
            <MenuItem onSelect={() => navigation.open({ kind: 'notes' })}>
              {t('library.pages.notes')}
            </MenuItem>
            <MenuItem onSelect={() => navigation.open({ kind: 'annotations' })}>
              {t('library.pages.annotations')}
            </MenuItem>
            <MenuItem onSelect={() => navigation.open({ kind: 'tags' })}>
              {t('library.pages.tags')}
            </MenuItem>
          </MenuContent>
        </Menu>
      </PageBar>
      <LibraryPanes
        label={t('library.browse.resize')}
        left={<LibraryExplorer api={api} navigation={navigation} />}
      >
        <Show when={navigation.current()} keyed>
          {(visit) => display(visit.page, navigation.open, visit)}
        </Show>
      </LibraryPanes>
      <Show when={searching()}>
        <EntryPicker
          api={api}
          types={entryTypes}
          title={t('library.organize.search')}
          choose={([ref]) => {
            if (ref) {
              openEntry(ref)
            }
          }}
          close={() => setSearching(false)}
        />
      </Show>
      <Dialog
        open={!!dialog()}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(undefined)
          }
        }}
      >
        <DialogContent size="lg">
          <DialogHeader closeLabel={t('actions.close')}>
            <DialogTitle>{t('library.pages.library')}</DialogTitle>
          </DialogHeader>
          <DialogBody class="h-[65dvh] overflow-hidden p-0">
            <Show when={dialog()} keyed>
              {(page) => display(page, setDialog)}
            </Show>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  )
}
