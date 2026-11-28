import { createSignal, For, Show } from 'solid-js'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@kisaki3/desktop-ui/dialog'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { Button } from '@kisaki3/desktop-ui/button'
import { SearchInput } from '@kisaki3/desktop-ui/input'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { mdiLightningBoltOutline } from '@mdi/js'
import type { Translate } from '@kisaki3/desktop-localization'
import { errorMessage } from '../../../../infrastructure/notifications'

export function PresetButton(props: { t: Translate; open: () => void }) {
  const label = () => props.t('showcase.presetsTitle')
  return (
    <Button
      size="icon-sm"
      variant="outline"
      aria-label={label()}
      title={label()}
      onClick={props.open}
    >
      <Icon path={mdiLightningBoltOutline} />
    </Button>
  )
}

export interface PresetChoice {
  id: string
  name: string
  description: string
}
export function PresetPicker<T extends PresetChoice>(props: {
  t: Translate
  items: readonly T[]
  multiple: boolean
  apply: (items: readonly T[]) => Promise<void> | void
  close: () => void
}) {
  const { t } = props
  const [term, setTerm] = createSignal('')
  const [checked, setChecked] = createSignal<readonly string[]>([])
  const [focus, setFocus] = createSignal<T>()
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<unknown>()
  const matches = () =>
    props.items.filter((item) =>
      (item.name + ' ' + item.description).toLowerCase().includes(term().trim().toLowerCase()),
    )
  async function apply() {
    const items = props.multiple
      ? props.items.filter((item) => checked().includes(item.id))
      : props.items.filter((item) => item.id === focus()?.id)
    if (!items.length) {
      return
    }
    setBusy(true)
    try {
      await props.apply(items)
      props.close()
    } catch (cause) {
      setError(() => cause)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy()) {
          props.close()
        }
      }}
    >
      <DialogContent size="md">
        <DialogHeader closeLabel={t('actions.close')}>
          <DialogTitle>{t('showcase.presetsTitle')}</DialogTitle>
        </DialogHeader>
        <DialogBody class="space-y-3">
          <SearchInput
            autofocus
            value={term()}
            clearLabel={t('controls.search.clear')}
            aria-label={t('controls.search.label')}
            onValueChange={setTerm}
          />
          <div class="max-h-72 space-y-1 overflow-auto">
            <For each={matches()} fallback={<p>{t('controls.search.empty')}</p>}>
              {(item) => (
                <div class="flex items-center gap-2">
                  <Show when={props.multiple}>
                    <Checkbox
                      aria-label={item.name}
                      checked={checked().includes(item.id)}
                      onCheckedChange={(on) =>
                        setChecked((ids) =>
                          on ? [...ids, item.id] : ids.filter((id) => id !== item.id),
                        )
                      }
                    />
                  </Show>
                  <Button
                    class="min-w-0 grow justify-start"
                    variant={focus()?.id === item.id ? 'secondary' : 'ghost'}
                    onClick={() => setFocus(() => item)}
                  >
                    {item.name}
                  </Button>
                </div>
              )}
            </For>
          </div>
          <Show when={focus()}>
            {(item) => <p class="text-sm text-muted-foreground">{item().description}</p>}
          </Show>
        </DialogBody>
        <DialogFooter>
          <Show when={error()}>
            {(cause) => (
              <span role="alert" class="me-auto text-destructive">
                {errorMessage(cause())}
              </span>
            )}
          </Show>
          <Button variant="ghost" disabled={busy()} onClick={props.close}>
            {t('actions.cancel')}
          </Button>
          <Button
            disabled={busy() || !(props.multiple ? checked().length : focus())}
            onClick={() => void apply()}
          >
            {t(props.multiple ? 'actions.create' : 'actions.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
