/** @fileoverview Renders verified font samples and file metadata in the owning document. */

import { createEffect, createSignal, createUniqueId, For, onCleanup, Show } from 'solid-js'
import type { FontFileMetadata, FontMetricRange } from '@kisaki3/desktop-contracts/fonts'
import type { Translate } from '@kisaki3/desktop-localization'
import { deferDialogUntil } from '@kisaki3/desktop-ui/dialog'
import { errorMessage } from '../../../../infrastructure/notifications'

/** Names the face as recorded in the verified file, including its subfamily when needed. */
export function fontFaceName(metadata: FontFileMetadata): string {
  const face = metadata.faces[0]
  return face.fullName ?? [face.family, face.subfamily].filter(Boolean).join(' ')
}

/** Formats the default value and the bounds of a variable metric. */
function metric(value: FontMetricRange, suffix = ''): string {
  return value.min === value.max
    ? String(value.default) + suffix
    : value.min + suffix + '–' + value.max + suffix
}

/** Shows the file's own face rather than resolving a same-named font installed on the system. */
export function FontSpecimen(props: {
  t: Translate
  metadata: FontFileMetadata
  url?: string | undefined
}) {
  const [loaded, setLoaded] = createSignal(false)
  const [failure, setFailure] = createSignal<string>()
  const name = 'Kisaki-preview-' + createUniqueId()
  const face = () => props.metadata.faces[0]
  deferDialogUntil(() => !props.url || loaded() || failure() !== undefined)

  createEffect(() => {
    const url = props.url
    setLoaded(false)
    setFailure(undefined)
    if (!url) {
      return
    }

    const current = face()
    const font = new FontFace(name, 'url(' + JSON.stringify(url) + ')', {
      style: current.style,
      weight: String(current.weight.default),
      stretch: current.width.default + '%',
    })
    let active = true

    // Loading can settle after the selected file's reader releases its URL.
    onCleanup(() => {
      active = false
      document.fonts.delete(font)
    })
    void font
      .load()
      .then((ready) => {
        if (active) {
          document.fonts.add(ready)
          setLoaded(true)
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setFailure(errorMessage(cause))
        }
      })
  })

  return (
    <div class="min-w-0 space-y-2">
      <Show when={loaded()}>
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
      <Show when={failure()}>
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
