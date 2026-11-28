import {
  partTypes,
  partWorkType,
  type FileAssociationInput,
  type FileWorkType,
  type HeldFile,
  type PartDetails,
  type PartQuery,
} from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { createForm, Form, FormFeedback } from '@kisaki3/desktop-ui/form'
import { dequal } from 'dequal'
import { createSignal, For, Show } from 'solid-js'
import type { MainClient } from '../../../../../../infrastructure/api'
import type { EditorGuard } from '../../../../../../infrastructure/dialogs/closing'
import { libraryRead } from '../../read'

export function FileAssociations(props: {
  api: MainClient
  file: HeldFile
  register: (v: EditorGuard) => void
  close: () => void
  saved: () => void
}) {
  const { api, file } = props,
    t = api.t
  const [selected, setSelected] = createSignal<readonly FileAssociationInput<FileWorkType>[]>(
    file.associations,
  )
  const read = libraryRead(api, ['parts', 'holdings'], async (signal) => {
    const rows: PartDetails[] = []
    for (const partType of partTypes.filter((kind) => partWorkType(kind) === file.work.type)) {
      for (let offset = 0; ; offset += 200) {
        const page = await api.request(
          signal,
          'library.parts.list',
          { work: file.work, partType, search: '' } as PartQuery,
          { offset, limit: 200 },
        )
        rows.push(...page.items)
        if (offset + page.items.length >= page.total) {
          break
        }
      }
    }
    return rows
  })
  const dirty = () => !dequal(selected(), file.associations)
  const form = createForm({
    onSubmit: async () => {
      await api.call('library.files.associations', file.work, file.id, {
        change: { type: 'replace', items: selected() },
        ...(file.associationMode && {
          expected: { associationMode: file.associationMode, associations: file.associations },
        }),
      })
      props.saved()
    },
  })
  props.register({
    dirty,
    save: form.submit,
    pending: () => (form.busy() ? form.submit() : undefined),
    currentFormAction: () => form.submit,
  })
  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>{t('library.holdings.editParts')}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody class="space-y-3">
          <p class="break-all text-sm">{file.path}</p>
          <For each={read.result()?.value}>
            {(row) => {
              const assoc = () =>
                selected().find(
                  (item) => item.part.type === row.ref.type && item.part.id === row.ref.id,
                )
              const name =
                row.data.name ||
                ('numberLabel' in row.data && row.data.numberLabel) ||
                t(`library.parts.${row.ref.type}`)
              return (
                <div class="flex justify-between gap-2">
                  <label class="flex items-center gap-2">
                    <Checkbox
                      checked={!!assoc()}
                      onCheckedChange={(on) =>
                        setSelected((before) =>
                          on
                            ? [...before, { part: row.ref, isPreferred: false }]
                            : before.filter((item) => item !== assoc()),
                        )
                      }
                    />
                    {name}
                  </label>
                  <Show when={assoc()}>
                    {(link) => (
                      <label class="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={!!link().isPreferred}
                          onCheckedChange={(on) =>
                            setSelected((before) =>
                              before.map((item) =>
                                item === link() ? { ...item, isPreferred: on } : item,
                              ),
                            )
                          }
                        />
                        {t('library.holdings.prefer')}
                      </label>
                    )}
                  </Show>
                </div>
              )
            }}
          </For>
        </DialogBody>
        <DialogFooter>
          <FormFeedback summary={(count) => t('forms.fieldErrors', { count })} />
          <Button variant="ghost" onClick={props.close}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" disabled={form.busy()}>
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </Form>
    </>
  )
}
