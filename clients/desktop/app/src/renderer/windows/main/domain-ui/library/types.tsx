import { createSignal, For } from 'solid-js'
import { entryTypes, workTypes, type EntryRule } from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@kisaki3/desktop-ui/popover'
import { mdiChevronDown } from '@mdi/js'
import type { Translate } from '@kisaki3/desktop-localization'
import { catalogIcon } from './icons'

export function TypeRange(props: {
  t: Translate
  value: EntryRule['types']
  change: (types: EntryRule['types']) => void
}) {
  const { t } = props
  const [open, setOpen] = createSignal(false)
  const [selected, setSelected] = createSignal<EntryRule['types']>(props.value)
  function toggle(type: (typeof entryTypes)[number], checked: boolean) {
    const [first, ...rest] = entryTypes.filter((item) =>
      item === type ? checked : selected().includes(item),
    )
    if (first) {
      setSelected([first, ...rest])
    }
  }
  function adopt(types: EntryRule['types']) {
    props.change(types)
    setOpen(false)
  }

  return (
    <div class="catalog-type-range" role="group" aria-label={t('library.browse.types')}>
      <For each={entryTypes}>
        {(type) => (
          <Button
            variant="ghost"
            size="icon-sm"
            class="catalog-type"
            aria-label={t(`library.types.${type}`)}
            aria-pressed={props.value.includes(type) ? 'true' : 'false'}
            title={t(`library.types.${type}`)}
            onClick={() => adopt([type])}
          >
            <Icon class="size-4" path={catalogIcon[type]} />
          </Button>
        )}
      </For>
      <Popover
        open={open()}
        onOpenChange={(value) => {
          if (value) {
            setSelected(props.value)
          }
          setOpen(value)
        }}
      >
        <PopoverTrigger
          variant="ghost"
          size="icon-sm"
          class="catalog-type"
          aria-label={
            t('library.browse.types') +
            ' · ' +
            props.value.map((item) => t(`library.types.${item}`)).join(', ')
          }
        >
          <Icon path={mdiChevronDown} class="size-3" />
        </PopoverTrigger>
        <PopoverContent placement="bottom-start" class="w-56 space-y-3">
          <div class="flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => adopt(workTypes)}>
              {t('library.browse.works')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => adopt(entryTypes)}>
              {t('library.browse.all')}
            </Button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <For each={entryTypes}>
              {(type) => (
                <label class="flex items-center gap-1.5">
                  <Checkbox
                    checked={selected().includes(type)}
                    disabled={selected().length === 1 && selected()[0] === type}
                    onCheckedChange={(on) => toggle(type, on)}
                  />
                  {t(`library.types.${type}`)}
                </label>
              )}
            </For>
          </div>
          <Button size="sm" onClick={() => adopt(selected())}>
            {t('actions.confirm')}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
