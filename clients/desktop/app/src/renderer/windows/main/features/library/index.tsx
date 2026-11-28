import {
  entryTypes,
  type EntryRef,
  type ShowcaseFields,
  type ShowcaseQuery,
} from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kisaki3/desktop-ui/dialog'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@kisaki3/desktop-ui/menu'
import { mdiArrowLeft, mdiBookshelf, mdiDotsHorizontal, mdiMagnify } from '@mdi/js'
import { createSignal, onSettled, Show } from 'solid-js'
import type { MainClient } from '../../../../infrastructure/api'
import type { CardItem } from '../../domain-ui/library/cards'
import { EntryPicker } from '../../domain-ui/library/entries/picker'
import { browseQuery } from '../../domain-ui/library/entries/query'
import { PageBar } from '../../domain-ui/page-bar'
import { BrowseEntries } from './browse'
import { EntryDialog } from './entries/dialog'
import { EntryPage } from './entries/page'
import { LibraryExplorer } from './explorer'
import type { LibraryNavigation, LibraryPage, LibraryVisit } from './navigation'
import { Organizers } from './organizers'
import { LibraryPanes } from './panes'
import { RecordPage } from './records'
import { Showcase } from './showcase'

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
      case 'notes':
        return <RecordPage api={api} page={page} receipt={visit?.receipt} open={openEntry} />
      case 'showcase':
        return <Showcase api={api} visit={visit} open={openCard} all={all} />
      case 'entry':
        return (
          <EntryPage
            receipt={visit?.receipt}
            initialTab={visit?.tab}
            tabChanged={(tab) => {
              if (visit) {
                visit.tab = tab
              }
            }}
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
        <Show when={dialog()} keyed>
          {(page) =>
            page.kind === 'entry' ? (
              <EntryDialog
                api={api}
                target={page.entry}
                {...(page.location && { location: page.location })}
                open={(entry) => setDialog({ kind: 'entry', entry })}
                openOrganizer={(type, id, title) =>
                  setDialog({ kind: 'entries', query: browseQuery({ type, id }), title })
                }
              />
            ) : (
              <DialogContent size="lg">
                <DialogHeader closeLabel={t('actions.close')}>
                  <DialogTitle>{t('library.pages.library')}</DialogTitle>
                </DialogHeader>
                <DialogBody class="h-[65dvh] overflow-hidden p-0">
                  {display(page, setDialog)}
                </DialogBody>
              </DialogContent>
            )
          }
        </Show>
      </Dialog>
    </div>
  )
}
