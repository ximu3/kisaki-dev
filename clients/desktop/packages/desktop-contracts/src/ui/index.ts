/** @fileoverview Publishes desktop UI capabilities and their view, page, menu, feedback and navigation contracts. */

export type { UiApi } from './api'

export { parseExtensionViewDocument } from './views'
export type {
  ExtensionViewDocument,
  ViewMethod,
  ViewMethods,
  ViewNotifications,
  ViewHostIpc,
  ViewClientIpc,
  HostView,
  ViewContext,
  ExtensionViewDefinition,
  ExtensionDialogsApi,
} from './views'

export { parsePageRef } from './pages'
export type { PageRef, ExtensionPageDefinition, ExtensionPagesApi } from './pages'

export { validateExtensionMenuItems } from './menus'
export type {
  ExtensionMenuItemPresentation,
  ExtensionMenuFeedback,
  ExtensionMenuItem,
  ExtensionMenuContextMap,
  ExtensionMenusApi,
} from './menus'

export { parseToastMessage, parseNotificationMessage } from './feedback'
export type {
  ToastMessage,
  ToastHandle,
  ToastApi,
  NotificationMessage,
  NotificationsApi,
} from './feedback'

export { parseExtensionUiIcon, parseLucideIconName } from './icons'
export type { ExtensionUiIcon, LucideIconName } from './icons'

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
