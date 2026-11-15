/** @fileoverview Native multiline editing with the same text and field contract as Input. */

import { splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { assignRef, callHandler, classes } from '../../internal/dom'
import { fieldAttributes } from '../../internal/field'
import { bindTextControl } from '../../internal/text-control'
import type { TextValueProps } from '../../internal/text-control'
import surface from '../../internal/input-surface.module.css'
import styles from './styles.module.css'

/** Native multiline text attributes with controlled value and default reset-baseline support. */
export interface TextareaProps
  extends Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'>, TextValueProps {}

/**
 * Binds multiline native editing and Field associations while preserving selection, composition and
 * undo.
 *
 * The caller owns persistence.
 */
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
  /** Text-value dispatcher shared by the textarea owner and native form integration. */
  const update = bindTextControl(local, () => input)

  return (
    <textarea
      {...fieldAttributes(props)}
      {...rest}
      ref={(node) => {
        input = node
        assignRef(local.ref, node)
      }}
      class={classes(surface.surface, styles.root, local.class)}
      onInput={(event) => {
        update()
        callHandler(local.onInput, event)
      }}
    />
  )
}
