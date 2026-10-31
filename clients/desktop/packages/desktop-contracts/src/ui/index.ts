/** @fileoverview Exposes stable navigation, actual view lifetimes, and finite UI contribution contracts. */

export type { PageRef } from './pages'
export { parsePageRef } from './pages'
export type { SearchTarget, NativeViewTarget } from './navigation'
export type {
  UiIcon,
  UiDocument,
  ToastMessage,
  ToastHandle,
  ToastApi,
  PrivateMethod,
  NodeViewIpc,
  WebviewIpc,
  NodeView,
  PageDefinition,
  DialogDefinition,
  MenuContextMap,
  MenuContextKind,
  MenuActionResult,
  MenuItem,
  MenusApi,
  UiApi,
  NotificationsApi,
} from './contributions'
export {
  parseUiDocument,
  parseUiIcon,
  parseToastMessage,
  parseExternalUrl,
  validateMenuGroups,
} from './contributions'
export { parseMenuItems } from './contributions'
