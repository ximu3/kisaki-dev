import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/utils/set-custom-native-drag-preview'
import { pointerOutsideOfPreview } from '@atlaskit/pragmatic-drag-and-drop/utils/pointer-outside-of-preview'
import { classes } from '../../internal/dom'
import surface from '../../internal/popup/surface.module.css'
import styles from './styles.module.css'

export function setDragPreview(options: {
  nativeSetDragImage: Parameters<typeof setCustomNativeDragPreview>[0]['nativeSetDragImage']
  label: string
}): void {
  setCustomNativeDragPreview({
    nativeSetDragImage: options.nativeSetDragImage,
    // Offset the drag image so native feedback leaves the pointer visible.
    getOffset: pointerOutsideOfPreview({ x: '12px', y: '8px' }),

    render: ({ container }) => {
      const preview = container.ownerDocument.createElement('div')
      preview.className = classes(surface.staticSurface, styles.preview)
      preview.textContent = options.label
      container.append(preview)
    },
  })
}
