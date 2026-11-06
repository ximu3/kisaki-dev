/** @fileoverview Host-owned image URLs with loading and failure presentation. */

import { createEffect, createSignal, Show, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { callHandler, classes } from '../../internal/dom'
import styles from './styles.module.css'

/** alt is required; the host acquires and releases URLs, while fallback supplies visible failure content. */
export interface ImageProps extends Omit<JSX.ImgHTMLAttributes<HTMLImageElement>, 'alt'> {
  alt: string
  fallback?: JSX.Element
}

/** Updates and retries when src changes; never revokes a URL supplied by the host. */
export function Image(props: ImageProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'fallback', 'src', 'alt', 'onLoad', 'onError'])

  const [failed, setFailed] = createSignal(false)
  createEffect(() => {
    void local.src
    setFailed(false)
  })

  return (
    <Show
      when={!failed() && local.src}
      fallback={
        <span
          class={classes(styles.fallback, local.class)}
          role={local.alt ? 'img' : undefined}
          aria-hidden={local.alt ? undefined : true}
          aria-label={local.alt}
        >
          {local.fallback ?? local.alt}
        </span>
      }
    >
      <img
        {...rest}
        src={local.src}
        alt={local.alt}
        class={classes(styles.root, local.class)}
        onLoad={(event) => callHandler(local.onLoad, event)}
        onError={(event) => {
          setFailed(true)
          callHandler(local.onError, event)
        }}
      />
    </Show>
  )
}
