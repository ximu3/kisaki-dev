import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/utils/set-custom-native-drag-preview'
import { pointerOutsideOfPreview } from '@atlaskit/pragmatic-drag-and-drop/utils/pointer-outside-of-preview'
import { classes } from '../../internal/dom'
import surface from '../../internal/popup/surface.module.css'
import styles from './styles.module.css'

/**
 * Creates a compact text drag image using the toolkit's capture and cleanup lifecycle.
 *
 * The host calls it from onGenerateDragPreview with a description of the moved selection.
 */
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
