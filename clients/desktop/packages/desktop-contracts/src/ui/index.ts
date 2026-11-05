/** @fileoverview Publishes desktop UI capabilities and their view, page, menu, feedback and navigation contracts. */

export type { UiApi } from './api'

export { parseViewDocument } from './views'
export type {
  ViewDocument,
  ViewMethod,
  ViewMethods,
  ViewNotifications,
  ViewHostIpc,
  ViewClientIpc,
  HostView,
  ViewContext,
  ViewDefinition,
  DialogsApi,
} from './views'

export { parsePageRef } from './pages'
export type { PageRef, PageDefinition, PagesApi } from './pages'

export { validateMenuItems } from './menus'
export type {
  MenuItemPresentation,
  MenuFeedback,
  MenuItem,
  MenuContextMap,
  MenusApi,
} from './menus'

export { parseToastMessage, parseNotificationMessage } from './feedback'
export type {
  ToastMessage,
  ToastHandle,
  ToastApi,
  NotificationMessage,
  NotificationsApi,
} from './feedback'

export { parseUiIcon } from './icons'
export type { UiIcon } from './icons'

export {
  parseEntryIdentifier,
  parseEntryViewSelection,
  parseNativeViewTarget,
  parseSearchTarget,
} from './navigation'
export type {
  EntryIdentifier,
  EntryViewSelectionByType,
  EntryViewSelection,
  EntryViewTarget,
  NativeViewTarget,
  SearchTarget,
} from './navigation'
