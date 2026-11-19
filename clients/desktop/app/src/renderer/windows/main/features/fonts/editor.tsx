/** @fileoverview Edits a font as one name and verified file-set draft. */

import { For, onCleanup, onMount, Show } from 'solid-js'
import { FileType, Plus, Trash2, RotateCcw } from 'lucide-solid'
import type { Font } from '@kisaki3/desktop-contracts/fonts'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { Badge } from '@kisaki3/desktop-ui/badge'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  deferDialogUntil,
} from '@kisaki3/desktop-ui/dialog'
import { Field, FieldContent, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import { createForm, Form, FormFeedback } from '@kisaki3/desktop-ui/form'
import { Input } from '@kisaki3/desktop-ui/input'
import { List, ListItem, ListItemAction } from '@kisaki3/desktop-ui/list'
import { Toolbar, ToolbarRow } from '@kisaki3/desktop-ui/toolbar'
import type { MainClient } from '../../../../infrastructure/api'
import type { EditorGuard } from '../../../../infrastructure/dialogs/closing'
import { errorMessage, reportError } from '../../../../infrastructure/notifications'
import { createFontRead } from './read'
import { fontFaceName, FontSpecimen } from './specimen'
import { createFontDraft } from './draft'

/** Previews existing and proposed files, with reversible removal until the draft is saved. */
export function FontEditor(props: {
  api: MainClient
  initial: Font | null
  files: readonly File[]
  bind: (guard: EditorGuard) => void
  cancel: () => void
  saved: (font: Font) => void
}) {
  const { api } = props
  const draft = createFontDraft(api, props.initial)
  const preview = createFontRead(api, () => draft.original() ?? undefined)
  deferDialogUntil(
    () => !draft.preparing() && (!draft.original() || !!preview.error() || !!preview.value()),
  )

  let active = true
  onCleanup(() => {
    active = false
  })
  onMount(() => {
    if (props.files.length) {
      void draft.receive(props.files)
    }
  })

  async function save() {
    const font = await draft.save()
    if (active && !draft.dirty()) {
      props.saved(font)
    }
  }

  const form = createForm({
    validate: () => [
      ...(!draft.name().trim() ? [{ id: 'name', summary: api.t('runtime.enterName') }] : []),
      ...(draft.preparing() ? [{ id: 'files', summary: api.t('runtime.preparingFonts') }] : []),
      ...(draft.failed() ? [{ id: 'files', summary: api.t('runtime.removeFailedFiles') }] : []),
      ...(!draft.preparing() && !draft.count()
        ? [{ id: 'files', summary: api.t('runtime.addFontFile') }]
        : []),
    ],
    order: () => ['name', 'files'],
    locate: (key) => document.getElementById('font-field-' + key)?.focus(),
    onSubmit: save,
  })
  const guard = { busy: form.busy, dirty: draft.dirty, save: () => form.submit() }
  props.bind(guard)

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>{api.t(props.initial ? 'runtime.editFont' : 'runtime.newFont')}</DialogTitle>
      </DialogHeader>
      <Form
        state={form}
        onDragOver={(event) => {
          if (event.dataTransfer?.types.includes('Files')) {
            event.preventDefault()
          }
        }}
        onDrop={(event) => {
          if (event.dataTransfer?.files.length) {
            event.preventDefault()
            void draft.receive(Array.from(event.dataTransfer.files))
          }
        }}
        onPaste={(event) => {
          if (event.clipboardData?.files.length) {
            event.preventDefault()
            void draft.receive(Array.from(event.clipboardData.files))
          }
        }}
      >
        <DialogBody>
          <FieldGroup>
            <Field name="name" id="font-field-name" required>
              <FieldLabel>{api.t('runtime.name')}</FieldLabel>
              <Input autofocus value={draft.name()} onValueChange={draft.rename} />
            </Field>
            <Field name="files" id="font-field-files">
              <FieldLabel>{api.t('runtime.files')}</FieldLabel>
              <FieldContent class="flex-col items-stretch">
                <Toolbar class="justify-between">
                  <ToolbarRow>
                    <Button
                      id="font-field-files"
                      aria-invalid={
                        form.issues().some((issue) => issue.id === 'files') || undefined
                      }
                      aria-describedby={
                        form.issues().some((issue) => issue.id === 'files')
                          ? 'font-field-files-error'
                          : undefined
                      }
                      variant="outline"
                      disabled={draft.choosing()}
                      onClick={() => void draft.choose().catch(reportError)}
                    >
                      <Plus />
                      {api.t('runtime.addFiles')}
                    </Button>
                  </ToolbarRow>
                </Toolbar>

                <Show when={preview.error()}>
                  {(cause) => <Alert tone="destructive">{errorMessage(cause())}</Alert>}
                </Show>

                <List>
                  <For each={draft.original()?.files}>
                    {(file) => {
                      const kept = () => draft.kept().includes(file.attachmentId)
                      const name = fontFaceName(file.metadata)

                      return (
                        <ListItem
                          icon={<FileType />}
                          title={
                            <div class="flex flex-wrap items-center gap-2">
                              <span>{name}</span>
                              <Badge tone={kept() ? 'outline' : 'warning'}>
                                {api.t(kept() ? 'runtime.fontKept' : 'runtime.fontRemoved')}
                              </Badge>
                            </div>
                          }
                          actions={
                            <ListItemAction
                              label={api.t(kept() ? 'runtime.remove' : 'runtime.restoreFile')}
                              aria-label={
                                kept()
                                  ? api.t('runtime.removeFile', { name })
                                  : api.t('runtime.restoreFile')
                              }
                              disabled={form.busy()}
                              destructive={kept()}
                              onClick={() => draft.toggle(file.attachmentId)}
                            >
                              {kept() ? <Trash2 /> : <RotateCcw />}
                            </ListItemAction>
                          }
                        >
                          <Show when={kept()}>
                            <FontSpecimen
                              t={api.t}
                              metadata={file.metadata}
                              url={preview.value()?.urls[file.attachmentId]}
                            />
                          </Show>
                        </ListItem>
                      )
                    }}
                  </For>
                  <For each={draft.files()}>
                    {(entry) => (
                      <ListItem
                        icon={<FileType />}
                        title={
                          <div class="flex flex-wrap items-center gap-2">
                            <span>{entry.name}</span>
                            <Show when={entry.status === 'ready'}>
                              <Badge tone="secondary">{api.t('runtime.fontAdded')}</Badge>
                            </Show>
                          </div>
                        }
                        actions={
                          <Show when={entry.status !== 'pending'}>
                            <ListItemAction
                              disabled={form.busy()}
                              label={api.t('runtime.remove')}
                              aria-label={api.t('runtime.removeFile', { name: entry.name })}
                              destructive
                              onClick={() => draft.remove(entry.key)}
                            >
                              <Trash2 />
                            </ListItemAction>
                          </Show>
                        }
                      >
                        {entry.status === 'pending' && (
                          <p class="m-0 text-xs text-muted-foreground" role="status">
                            {api.t('runtime.preparingFonts')}
                          </p>
                        )}
                        {entry.status === 'failed' && (
                          <Alert tone="destructive" role="alert">
                            {api.t('runtime.fontFileFailed', {
                              name: entry.name,
                              reason: entry.error,
                            })}
                          </Alert>
                        )}
                        {entry.status === 'ready' && (
                          <FontSpecimen
                            t={api.t}
                            metadata={entry.file.metadata}
                            url={entry.file.url}
                          />
                        )}
                      </ListItem>
                    )}
                  </For>
                </List>
              </FieldContent>
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <FormFeedback summary={(count) => api.t('runtime.fieldErrors', { count })} />
          <Button variant="ghost" onClick={props.cancel}>
            {api.t('actions.cancel')}
          </Button>
          <Button type="submit" disabled={form.busy() || draft.preparing() || !draft.dirty()}>
            {api.t('actions.save')}
          </Button>
        </DialogFooter>
      </Form>
    </>
  )
}
