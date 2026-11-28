import type { ShowcasePreset, ShowcaseSection } from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kisaki3/desktop-ui/dialog'
import { Icon } from '@kisaki3/desktop-ui/icon'
import {
  moveListItems,
  ReorderableList,
  ReorderableListItem,
  type ListMove,
} from '@kisaki3/desktop-ui/list'
import {
  mdiEyeOffOutline,
  mdiEyeOutline,
  mdiPencilOutline,
  mdiPlus,
  mdiTrashCanOutline,
  mdiViewDashboardOutline,
} from '@mdi/js'
import { createSignal, For, Show } from 'solid-js'
import type { MainClient } from '../../../../../infrastructure/api'
import { createConfirmation } from '../../../../../infrastructure/dialogs/confirmation'
import { reportError } from '../../../../../infrastructure/notifications'
import { catalogIcon } from '../../../domain-ui/library/icons'
import { PresetButton, PresetPicker } from '../../../domain-ui/preset-picker'
import { presetChoices, type SectionEdit } from './model'

function sectionIcon(row: ShowcaseSection) {
  if (row.query.status !== 'ready') {
    return mdiViewDashboardOutline
  }
  const query = row.query.value
  if (query.kind !== 'entry') {
    return catalogIcon[query.kind]
  }
  const types = new Set(query.rules.filter((r) => r.enabled).flatMap((r) => r.types))
  const type = types.values().next().value
  return types.size === 1 && type ? catalogIcon[type] : mdiViewDashboardOutline
}

export function SectionManager(props: {
  api: MainClient
  sections: readonly ShowcaseSection[]
  presets: readonly ShowcasePreset[]
  edit: (edit: SectionEdit) => void
  close: () => void
}) {
  const { api } = props
  const t = api.t
  const confirm = createConfirmation(t)
  const [picking, setPicking] = createSignal(false)
  const [viewport, setViewport] = createSignal<HTMLElement>()
  const order = () => props.sections.map((row) => row.id)
  async function move(movement: ListMove) {
    const original = order()
    const [first, ...rest] = moveListItems(original, movement)
    if (first) {
      await api.call('library.showcase.reorder', {
        order: [first, ...rest],
        expected: { order: original },
      })
    }
  }
  async function remove(row: ShowcaseSection) {
    if (await confirm.ask(t('showcase.remove'), t('actions.delete'), row.name)) {
      await api.call('library.showcase.delete', row.id)
    }
  }

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) {
            props.close()
          }
        }}
      >
        <DialogContent size="md">
          <DialogHeader closeLabel={t('actions.close')}>
            <DialogTitle>{t('showcase.manage')}</DialogTitle>
          </DialogHeader>
          <DialogBody class="py-3">
            <Show
              when={props.sections.length}
              fallback={
                <p class="py-8 text-center text-sm text-muted-foreground">{t('showcase.empty')}</p>
              }
            >
              <ReorderableList
                ref={setViewport}
                viewport={viewport}
                order={order()}
                class="max-h-[55dvh] space-y-1 overflow-auto"
                aria-label={t('showcase.manage')}
                labels={{
                  first: t('actions.moveFirst'),
                  previous: t('actions.moveUp'),
                  next: t('actions.moveDown'),
                  last: t('actions.moveLast'),
                  moved: (id, position) =>
                    t('navigation.moved', {
                      name: props.sections.find((row) => row.id === id)!.name,
                      position,
                    }),
                }}
                onMove={move}
                onMoveError={reportError}
              >
                <For each={props.sections} keyed={(row) => row.id}>
                  {(row) => (
                    <ReorderableListItem
                      value={row().id}
                      previewLabel={row().name}
                      moveLabel={t('navigation.move', { name: row().name })}
                      class={`group ${row().isVisible ? '' : 'opacity-50'}`}
                      icon={
                        <span class="grid size-10 place-items-center rounded-md bg-muted">
                          <Icon path={sectionIcon(row())} />
                        </span>
                      }
                      title={
                        <button
                          class="truncate text-start font-medium hover:underline"
                          onClick={() => props.edit({ saved: row() })}
                        >
                          {row().name}
                        </button>
                      }
                      description={t(`showcase.${row().layout}`)}
                      accessory={
                        <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t(row().isVisible ? 'showcase.hide' : 'showcase.show')}
                            onClick={() =>
                              void api
                                .call('library.showcase.update', row().id, {
                                  changes: { isVisible: !row().isVisible },
                                  expected: { isVisible: row().isVisible },
                                })
                                .catch(reportError)
                            }
                          >
                            <Icon path={row().isVisible ? mdiEyeOutline : mdiEyeOffOutline} />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t('actions.editItem', { name: row().name })}
                            onClick={() => props.edit({ saved: row() })}
                          >
                            <Icon path={mdiPencilOutline} />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={t('actions.deleteItem', { name: row().name })}
                            onClick={() => void remove(row()).catch(reportError)}
                          >
                            <Icon path={mdiTrashCanOutline} />
                          </Button>
                        </div>
                      }
                    />
                  )}
                </For>
              </ReorderableList>
            </Show>
          </DialogBody>
          <DialogFooter>
            <div class="me-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => props.edit({})}>
                <Icon path={mdiPlus} />
                {t('showcase.newSection')}
              </Button>
              <PresetButton t={t} open={() => setPicking(true)} />
            </div>
            <Button variant="outline" onClick={props.close}>
              {t('actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Show when={picking()}>
        <PresetPicker
          t={t}
          items={presetChoices(props.presets, api.locale())}
          multiple
          close={() => setPicking(false)}
          apply={async (selected) => {
            const [first, ...rest] = selected.map((item) => item.preset.initial)
            if (first) {
              await api.call('library.showcase.createMany', [first, ...rest])
            }
          }}
        />
      </Show>
      <confirm.Content />
    </>
  )
}
