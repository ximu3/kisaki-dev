/** @fileoverview Compact native drag images use the toolkit's capture and cleanup lifecycle. */

import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/utils/set-custom-native-drag-preview'
import { pointerOutsideOfPreview } from '@atlaskit/pragmatic-drag-and-drop/utils/pointer-outside-of-preview'
import styles from './styles.module.css'

/** Call from onGenerateDragPreview with a host-authored description of the moved selection. */
export function setDragPreview(options: {
  nativeSetDragImage: Parameters<typeof setCustomNativeDragPreview>[0]['nativeSetDragImage']
  label: string
}): void {
  setCustomNativeDragPreview({
    nativeSetDragImage: options.nativeSetDragImage,
    getOffset: pointerOutsideOfPreview({ x: '12px', y: '8px' }),
    render: ({ container }) => {
      const preview = container.ownerDocument.createElement('div')
      preview.className = styles.preview!
      preview.textContent = options.label
      container.append(preview)
    },
  })
}
