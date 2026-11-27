import { createMemo, createSignal, For, Show } from 'solid-js'
import { mdiFileDocumentOutline } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
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
import {
  observeDialogTarget,
  type DialogReceipt,
} from '../../../../infrastructure/dialogs/presentation'
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
  receipt: DialogReceipt | undefined
}) {
  const { api } = props
  const [visible, setVisible] = createSignal(false)
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
      <DialogContent size="lg" onToggle={(event) => setVisible(event.currentTarget.open)}>
        <Show when={displayed()} keyed>
          {(selection) => (
            <FontPreview
              api={api}
              selection={selection}
              receipt={props.receipt}
              visible={visible()}
            />
          )}
        </Show>
      </DialogContent>
    </Dialog>
  )
}

function FontPreview(props: {
  api: MainClient
  selection: FontSelection
  receipt: DialogReceipt | undefined
  visible: boolean
}) {
  const { api } = props
  const preview = createFontRead(api, () => props.selection)
  const name = () =>
    preview.value()?.font.name ?? props.selection.name ?? api.t('fonts.preview.title')
  deferDialogUntil(() => !!preview.error() || !!preview.value())

  observeDialogTarget(props.receipt, () => ({
    presented: props.visible && !!preview.value(),
    error: preview.error(),
  }))

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>{name()}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <Show when={preview.loading()}>
          <Spinner label={api.t('fonts.selector.loading')} />
        </Show>
        <QueryError
          error={preview.error()}
          retryLabel={api.t('actions.retry')}
          retry={preview.retry}
        />
        <Show when={preview.value()}>
          {(opened) => (
            <List>
              <For each={opened().font.files}>
                {(file) => (
                  <ListItem
                    icon={<Icon path={mdiFileDocumentOutline} />}
                    title={fontFaceName(file.metadata)}
                  >
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
