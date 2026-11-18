/** @fileoverview Previews the selected user's font files in an independently owned dialog. */

import { createMemo, For, Show } from 'solid-js'
import { FileType } from 'lucide-solid'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Button } from '@kisaki3/desktop-ui/button'
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
import { errorMessage } from '../../../../infrastructure/notifications'
import { createFontRead } from '../../domain-ui/fonts/read'
import { FontSpecimen, fontFaceName } from '../../domain-ui/fonts/specimen'

/** The saved font addressed by a row or native navigation target. */
export interface FontSelection {
  id: string
  name?: string | undefined
}

/** Displays the held files at their actual face and releases them when the preview ends. */
export function FontDetails(props: {
  api: MainClient
  selected: FontSelection | undefined
  close: () => void
}) {
  const { api } = props
  const displayed = createMemo<FontSelection | undefined>(
    (last) => props.selected ?? last,
    undefined,
  )

  return (
    <Dialog
      open={!!props.selected}
      onOpenChange={(open) => {
        if (!open) {
          props.close()
        }
      }}
    >
      <DialogContent size="lg">
        <Show when={displayed()} keyed>
          {(selection) => <FontPreview api={api} selection={selection} />}
        </Show>
      </DialogContent>
    </Dialog>
  )
}

/** Loads the selected record and mounts its document-owned samples before showing the dialog. */
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
        <Show when={preview.error()}>
          {(cause) => (
            <Alert tone="destructive" role="alert">
              {errorMessage(cause())}{' '}
              <Button variant="outline" onClick={preview.retry}>
                {api.t('runtime.retry')}
              </Button>
            </Alert>
          )}
        </Show>
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
