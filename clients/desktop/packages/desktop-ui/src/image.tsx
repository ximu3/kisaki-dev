/** @fileoverview Displays a host-owned image URL or the supplied missing-image representation. */

import { createSignal, Show, splitProps, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'

export interface ImageProps extends Omit<
  JSX.ImgHTMLAttributes<HTMLImageElement>,
  'srcset' | 'srcSet' | 'onError'
> {
  alt: string
  fallback?: JSX.Element
}

/** A changed source is loaded independently of an earlier failure. */
export function Image(props: ImageProps): JSX.Element {
  const [local, rest] = splitProps(props, ['src', 'class', 'fallback', 'alt'])

  return (
    <Show when={local.src} keyed fallback={local.fallback ?? local.alt}>
      {(src) => {
        const [failed, setFailed] = createSignal(false)
        return (
          <Show when={!failed()} fallback={local.fallback ?? local.alt}>
            <img
              {...rest}
              src={src}
              alt={local.alt}
              class={twMerge('block max-w-full object-cover', local.class)}
              onError={() => setFailed(true)}
            />
          </Show>
        )
      }}
    </Show>
  )
}
