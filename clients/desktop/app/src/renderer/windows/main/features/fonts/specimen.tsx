import { createEffect, createMemo, createUniqueId, For, Show } from 'solid-js'
import type { FontFileMetadata, FontMetricRange } from '@kisaki3/desktop-contracts/fonts'
import type { Translate } from '@kisaki3/desktop-localization'
import { deferDialogUntil } from '@kisaki3/desktop-ui/dialog'
import { errorMessage } from '../../../../infrastructure/notifications'

export function fontFaceName(metadata: FontFileMetadata): string {
  const face = metadata.faces[0]
  return face.fullName ?? [face.family, face.subfamily].filter(Boolean).join(' ')
}

function metric(value: FontMetricRange, suffix = ''): string {
  return value.min === value.max
    ? String(value.default) + suffix
    : value.min + suffix + '–' + value.max + suffix
}

export function FontSpecimen(props: {
  t: Translate
  metadata: FontFileMetadata
  url?: string | undefined
}) {
  const name = 'Kisaki-preview-' + createUniqueId()
  const face = () => props.metadata.faces[0]
  const sample = createMemo(
    () => {
      if (!props.url) {
        return undefined
      }
      const current = face()
      const font = new FontFace(name, 'url(' + JSON.stringify(props.url) + ')', {
        style: current.style,
        weight: String(current.weight.default),
        stretch: current.width.default + '%',
      })
      return font.load().then(
        (ready) => ({ font: ready, failure: undefined }),
        (cause: unknown) => ({ font: undefined, failure: errorMessage(cause) }),
      )
    },
    { loadingValue: undefined },
  )

  deferDialogUntil(() => !props.url || !!sample())
  createEffect(
    () => sample()?.font,
    (font) => {
      if (font) {
        document.fonts.add(font)
        return () => {
          document.fonts.delete(font)
        }
      }
    },
  )

  return (
    <div class="min-w-0 space-y-2">
      <Show when={sample()?.font}>
        <p
          class="m-0 break-words text-xl leading-snug"
          style={{
            'font-family': name,
            'font-weight': face().weight.default,
            'font-style': face().style,
            'font-stretch': face().width.default + '%',
          }}
        >
          {props.t('runtime.fontSample')}
        </p>
      </Show>
      <Show when={sample()?.failure}>
        {(reason) => (
          <p class="m-0 text-xs text-destructive" role="status">
            {props.t('runtime.previewFileFailed', { reason: reason() })}
          </p>
        )}
      </Show>
      <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{face().subfamily}</span>
        <span>
          {props.t('runtime.fontWeight')} {metric(face().weight)}
        </span>
        <span>
          {props.t('runtime.fontWidth')} {metric(face().width, '%')}
        </span>
        <For each={face().axes.filter(({ tag }) => tag !== 'wght' && tag !== 'wdth')}>
          {(axis) => (
            <span>
              {axis.tag} {metric(axis)}
            </span>
          )}
        </For>
      </div>
    </div>
  )
}
