/**
 * @fileoverview Exposes shared error, identity, execution, date, and deeplink contracts;
 * domain-specific values and operations use their public subpaths.
 */

export type { ErrorSummary, ExecutionFailure } from './errors'
export {
  desktopErrorCodes,
  ExecutionError,
  parseErrorSummary,
  parseExecutionFailure,
} from './errors'
export type { DesktopErrorCode } from './errors'
export type { CalendarDate, PartialDate, YearDate, MonthDate, Bounds } from './date'
export type {
  EntryType,
  WorkType,
  PartType,
  EntryRef,
  WorkRef,
  PartRef,
  ExternalIdentity,
  EntryIdentifier,
} from './library/identity'
export type {
  CallOptions,
  ExecutionContext,
  Disposable,
  AsyncDisposable,
  Registration,
  ListOptions,
  ListResult,
} from './execution'
export { parse as parseDeeplink, format as formatDeeplink, parseDeeplinkRequest } from './deeplink'
export type { DeeplinkScheme, DeeplinkRequest, ExtensionDeeplinkRequest } from './deeplink'
