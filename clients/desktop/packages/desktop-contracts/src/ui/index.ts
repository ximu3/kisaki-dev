/** @fileoverview Publishes the ui capability contract. */

export {
  parseViewDocument,
  parseUiIcon,
  parseToastMessage,
  validateMenuItems,
  parseNotificationMessage,
} from './api'

export { parsePageRef } from './pages'
export type { PageRef } from './pages'
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

export type {
  UiIcon,
  ViewDocument,
  ToastMessage,
  ToastHandle,
  ToastApi,
  ViewMethod,
  ViewMethods,
  ViewNotifications,
  ViewHostIpc,
  ViewClientIpc,
  HostView,
  ViewContext,
  ViewDefinition,
  PageDefinition,
  PagesApi,
  DialogsApi,
  MenuItemPresentation,
  MenuFeedback,
  MenuItem,
  MenuContextMap,
  MenusApi,
  NotificationMessage,
  NotificationsApi,
  UiApi,
} from './api'
