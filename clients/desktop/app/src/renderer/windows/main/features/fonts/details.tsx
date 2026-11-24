import { createMemo, For, Show } from 'solid-js'
import { FileType } from '@lucide/solid'
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogHeader,
  DialogTitle,
  deferDialogUntil,
} from '@kisaki3/desktop-ui/dialog'
import { List, ListItem } from '@kisaki3/desktop-ui/list'
import { Spinner } from '@kisaki3/desktop-ui/spinner'
import type { MainClient } from '../../../../infrastructure/api'
import { createFontRead } from './read'
import { FontSpecimen, fontFaceName } from './specimen'
import { QueryError } from '../../../../infrastructure/query/error'

export interface FontSelection {
  id: string
  name?: string | undefined
}

export function FontDetails(props: {
  api: MainClient
  selected: FontSelection | undefined
  close: () => void
  presented?: (() => void) | undefined
}) {
  const { api } = props
  const displayed = createMemo<FontSelection | undefined>((last) => props.selected ?? last)

  return (
    <Dialog
      open={!!props.selected}
      onOpenChange={(open) => {
        if (!open) {
          props.close()
        }
      }}
    >
      <DialogContent
        size="lg"
        onToggle={(event) => {
          if (event.currentTarget.open) {
            props.presented?.()
          }
        }}
      >
        <Show when={displayed()} keyed>
          {(selection) => <FontPreview api={api} selection={selection} />}
        </Show>
      </DialogContent>
    </Dialog>
  )
}

function FontPreview(props: { api: MainClient; selection: FontSelection }) {
  const { api } = props
  const preview = createFontRead(api, () => props.selection)
  const name = () =>
    preview.value()?.font.name ?? props.selection.name ?? api.t('runtime.fontPreview')
  deferDialogUntil(() => !!preview.error() || !!preview.value())

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>{name()}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <Show when={preview.loading()}>
          <Spinner label={api.t('runtime.loadingFonts')} />
        </Show>
        <QueryError
          error={preview.error()}
          retryLabel={api.t('runtime.retry')}
          retry={preview.retry}
        />
        <Show when={preview.value()}>
          {(opened) => (
            <List>
              <For each={opened().font.files}>
                {(file) => (
                  <ListItem icon={<FileType />} title={fontFaceName(file.metadata)}>
                    <FontSpecimen
                      t={api.t}
                      metadata={file.metadata}
                      url={opened().urls[file.attachmentId]}
                    />
                  </ListItem>
                )}
              </For>
            </List>
          )}
        </Show>
      </DialogBody>
    </>
  )
}
