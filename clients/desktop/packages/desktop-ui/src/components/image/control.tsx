/** @fileoverview Displays host-owned image URLs with accessible fallback content. */

import { createEffect, createSignal, Show, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { callHandler, classes } from '../../internal/dom'
import styles from './styles.module.css'

/**
 * Image attributes requiring alternative text and permitting visible fallback content.
 *
 * The host acquires and releases the supplied URL.
 */
export interface ImageProps extends Omit<JSX.ImgHTMLAttributes<HTMLImageElement>, 'alt'> {
  alt: string
  fallback?: JSX.Element
}

/**
 * Renders an image or accessible fallback for a missing or failed source.
 *
 * Changing src clears the failure state; URL ownership remains with the host.
 */
export function Image(props: ImageProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'fallback', 'src', 'alt', 'onLoad', 'onError'])

  /** Image-load failure state used to select the current fallback presentation. */
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
