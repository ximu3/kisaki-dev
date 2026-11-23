/** @fileoverview Displays host-owned image URLs with accessible fallback content. */

import { createEffect, createSignal, Show, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { callHandler } from '../../internal/dom'
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
 * Changing the source candidates clears the failure state; URL ownership remains with the host.
 */
export function Image(props: ImageProps): JSX.Element {
  const rest = omit(
    props,
    'class',
    'fallback',
    'src',
    'srcset',
    'sizes',
    'alt',
    'onLoad',
    'onError',
  )

  const candidates = () => props.srcset

  /** Image-load failure state used to select the current fallback presentation. */
  const [failed, setFailed] = createSignal(false)
  createEffect(
    () => [props.src, candidates(), props.sizes],
    () => {
      setFailed(false)
    },
  )

  return (
    <Show
      when={!failed() && (props.src || candidates())}
      fallback={
        <span
          class={[styles.fallback, props.class]}
          role={props.alt ? 'img' : undefined}
          aria-hidden={props.alt ? undefined : 'true'}
          aria-label={props.alt}
        >
          {props.fallback ?? props.alt}
        </span>
      }
    >
      <img
        {...rest}
        sizes={props.sizes}
        srcset={candidates()}
        src={props.src}
        alt={props.alt}
        class={[styles.root, props.class]}
        onLoad={(event) => callHandler(props.onLoad, event)}
        onError={(event) => {
          setFailed(true)
          callHandler(props.onError, event)
        }}
      />
    </Show>
  )
}
