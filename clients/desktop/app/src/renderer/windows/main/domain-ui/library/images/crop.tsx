import { createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@kisaki3/desktop-ui/dialog'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { NumberInput } from '@kisaki3/desktop-ui/input'
import type { ImageChoice } from '../../../../../../shared/window-api'
import type { MainClient } from '../../../../../infrastructure/api'
import { errorMessage } from '../../../../../infrastructure/notifications'

export function CropImage(props: {
  api: MainClient
  image: ImageChoice
  close: () => void
  apply: (image: ImageChoice) => void
}) {
  const { api, image } = props,
    t = api.t
  const full = { left: 0, top: 0, width: image.width, height: image.height }
  const [crop, setCrop] = createSignal(full),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal<unknown>()
  let anchor: { x: number; y: number } | undefined
  function point(e: PointerEvent) {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return {
      x: Math.round(Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)) * image.width),
      y: Math.round(Math.max(0, Math.min(1, (e.clientY - box.top) / box.height)) * image.height),
    }
  }
  function start(e: PointerEvent) {
    if (e.button !== 0) {
      return
    }
    anchor = point(e)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function drag(e: PointerEvent) {
    if (!anchor) {
      return
    }
    const p = point(e)
    if (p.x === anchor.x || p.y === anchor.y) {
      return
    }
    setCrop({
      left: Math.min(anchor.x, p.x),
      top: Math.min(anchor.y, p.y),
      width: Math.abs(anchor.x - p.x),
      height: Math.abs(anchor.y - p.y),
    })
  }
  const valid = () => {
    const r = crop()
    return (
      Object.values(r).every(Number.isSafeInteger) &&
      r.left >= 0 &&
      r.top >= 0 &&
      r.width > 0 &&
      r.height > 0 &&
      r.left + r.width <= image.width &&
      r.top + r.height <= image.height
    )
  }
  async function apply() {
    setBusy(true)
    try {
      const r = crop()
      props.apply(
        r.left === 0 && r.top === 0 && r.width === full.width && r.height === full.height
          ? image
          : await api.call('images.transform', image.id, { crop: r }),
      )
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
      <DialogContent size="lg">
        <DialogHeader closeLabel={t('actions.close')}>
          <DialogTitle>{t('library.records.crop')}</DialogTitle>
        </DialogHeader>
        <DialogBody class="space-y-3">
          <div class="flex justify-center overflow-hidden rounded-md bg-muted/50">
            <div
              class="relative inline-block max-w-full touch-none select-none"
              onPointerDown={start}
              onPointerMove={drag}
              onPointerUp={() => {
                anchor = undefined
              }}
              onPointerCancel={() => {
                anchor = undefined
              }}
            >
              <img
                draggable={false}
                src={image.url}
                class="block max-h-[44dvh] max-w-full"
                alt={t('library.records.crop')}
              />
              <div
                class="pointer-events-none absolute border-2 border-primary shadow-[0_0_0_100vmax_rgb(0_0_0/0.4)]"
                style={{
                  left: (crop().left / image.width) * 100 + '%',
                  top: (crop().top / image.height) * 100 + '%',
                  width: (crop().width / image.width) * 100 + '%',
                  height: (crop().height / image.height) * 100 + '%',
                }}
              />
            </div>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <For each={['left', 'top', 'width', 'height'] as const}>
              {(key) => (
                <Field>
                  <FieldLabel>{t(`library.records.${key}`)}</FieldLabel>
                  <NumberInput
                    step={1}
                    min={key === 'left' || key === 'top' ? 0 : 1}
                    value={String(crop()[key])}
                    increaseLabel={t('controls.number.increase')}
                    decreaseLabel={t('controls.number.decrease')}
                    onValueChange={(v) => setCrop((row) => ({ ...row, [key]: Number(v) }))}
                  />
                </Field>
              )}
            </For>
          </div>
          <Show when={error()}>{(e) => <p role="alert">{errorMessage(e())}</p>}</Show>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" disabled={busy()} class="me-auto" onClick={() => setCrop(full)}>
            {t('actions.reset')}
          </Button>
          <Button variant="ghost" disabled={busy()} onClick={props.close}>
            {t('actions.cancel')}
          </Button>
          <Button disabled={busy() || !valid()} onClick={() => void apply()}>
            {t('actions.use')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
