/** @fileoverview Native multiline editing with the same text and field contract as Input. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindTextControl } from '../../internal/text-control'
import type { TextValueProps } from '../../internal/text-control'
import styles from './styles.module.css'

/** Default text initializes the native reset baseline; value selects controlled mode. */
export interface TextareaProps
  extends Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'>, TextValueProps {}

/** Preserve multiline selection, composition and undo; the caller owns persistence. */
export function Textarea(props: TextareaProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'value',
    'defaultValue',
    'onValueChange',
    'ref',
    'class',
    'onInput',
  ])

  let input!: HTMLTextAreaElement
  const update = bindTextControl(local, () => input)

  return (
    <textarea
      {...fieldAttributes()}
      {...rest}
      ref={(node) => {
        input = node
        assignRef(local.ref, node)
      }}
      class={classes(styles.root, local.class)}
      onInput={(event) => {
        update()
        callHandler(local.onInput, event)
      }}
    />
  )
}
