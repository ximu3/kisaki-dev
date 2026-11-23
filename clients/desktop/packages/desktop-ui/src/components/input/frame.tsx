import type { JSX } from '@solidjs/web'
import type { ControlSize } from '../../internal/control/size'
import surface from '../../internal/input-surface.module.css'
import styles from './styles.module.css'

/** Shared editor-shell content, presentation attributes and picker-open state. */
interface InputFrameProps {
  children: JSX.Element
  class?: JSX.HTMLAttributes<HTMLDivElement>['class']
  style?: JSX.HTMLAttributes<HTMLDivElement>['style']
  size?: ControlSize | undefined
  open?: boolean
}

/**
 * Frames an editor and its actions, retaining active-field presentation while a picker owns focus.
 */
export function InputFrame(props: InputFrameProps): JSX.Element {
  return (
    <div
      class={[surface.surface, styles.frame, props.class]}
      style={props.style}
      data-size={props.size ?? 'default'}
      data-open={props.open || undefined}
    >
      {props.children}
    </div>
  )
}
