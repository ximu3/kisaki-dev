/** @fileoverview Selects native document methods and projections from the desktop capability contracts. */

import type { WindowKind } from './protocol'
import type { MessageCatalog, UiTranslation } from '@kisaki3/desktop-contracts/i18n'
import type {
  DesktopPlatform,
  Preferences,
  PreferencesSnapshot,
  PreferencesUpdate,
  PreferenceField,
} from '@kisaki3/desktop-contracts/preferences'
import type {
  TaskQuery,
  TaskState,
  TaskRun,
  TaskRunRef,
  TaskRunSummary,
  TaskHistoryFilter,
  TaskTerminalRun,
} from '@kisaki3/desktop-contracts/tasks'
import type {
  ViewAppearance,
  AppearanceIssue,
  Theme,
  ThemeRef,
  UserThemeCreate,
  UserThemeUpdate,
  AppearancePreviewInput,
} from '@kisaki3/desktop-contracts/appearance'
import type { Font, FontFileMetadata, FontUpdate } from '@kisaki3/desktop-contracts/fonts'
import type { ImageTransform, ImageFormat } from '@kisaki3/desktop-contracts/images'
import type { ListOptions, ListResult } from '@kisaki3/desktop-contracts/operations'
import type { NetworkState } from '@kisaki3/desktop-contracts/network'

import type {
  ApplicationExitState,
  SystemIntegrationState,
  DataModeChange,
  DataLocationState,
  LoginItemState,
  ProtocolIntegrationState,
  DesktopEntryState,
  ApplicationEnvironment,
} from '@kisaki3/desktop-contracts/app'

/** Document-owned handle to a file selected and validated by the main process. */
export interface FontChoice {
  id: string
  attachmentId: string
  url: string
  metadata: FontFileMetadata
}

/** Document-owned image preparation and its transient preview URL. */
export interface ImageChoice {
  id: string
  attachmentId: string
  width: number
  height: number
  format: ImageFormat
  frameCount: number
  url: string
}

/** State for this document's native browser window and effective translation. */
export interface WindowState {
  startupDeadline: number
  kind: WindowKind
  platform: DesktopPlatform
  buildId: string
  maximized: boolean
  locale: string
  messages: MessageCatalog
}

/** Shared operations available to all four native windows. */
export interface WindowApi {
  /** Reads the palette and scale available before document font loading finishes. */
  'appearance.base'(): ViewAppearance
  /** Acknowledges that this document can receive navigation and close requests. */
  'window.ready'(): void
  /** Reads the bound window identity, native state and effective language snapshot. */
  'window.state'(): WindowState
  /** Minimizes only the native window bound to this connection. */
  'window.minimize'(): void
  /** Toggles the bound window between maximized and restored bounds. */
  'window.maximize'(): void
  /** Requests the configured close behavior for this native window. */
  'window.close'(): void
  /** Resolves the effective branch and acquires font URLs for this document. */
  'appearance.get'(): { value: ViewAppearance; issues: readonly AppearanceIssue[]; hold: string }
  /** Releases the identified hold in this document without affecting other readers. */
  'resources.release'(id: string): void
}

/** The main window's settings, task center and native management capabilities. */
export interface MainWindowApi extends WindowApi {
  /** Adopts the resolved Chromium colors and height of the Windows system caption. */
  'window.caption'(background: string, foreground: string): void
  /** Starts the shared normal exit workflow from the main window. */
  'app.quit'(): void
  /** Restarts the application after the normal close workflow succeeds. */
  'app.restart'(): void
  /** Cancels a pending exit while preserving work already completed. */
  'app.cancelExit'(): void
  /** Reads current exit progress without starting a new attempt. */
  'app.exitState'(): ApplicationExitState
  /** Reads saved preference fields and the opaque proxy credential revision. */
  'preferences.get'(): PreferencesSnapshot
  /** Reads the current-language field directory used for preference navigation. */
  'preferences.fields'(): readonly PreferenceField[]
  /** Reads the complete default values for a reset draft. */
  'preferences.defaults'(): Preferences
  /** Validates the submitted fields and commits them against their baselines. */
  'preferences.update'(input: PreferencesUpdate): PreferencesSnapshot
  /** Lists built-in and registered translations by stable identity. */
  'translations.list'(): readonly UiTranslation[]
  /** Reads whether new requests can use the selected network route. */
  'network.state'(): NetworkState
  /** Reads one filtered interval of summaries and its total. */
  'tasks.list'(query: TaskQuery, options: ListOptions): ListResult<TaskRunSummary>
  /** Reads a full task record, returning null when history is absent. */
  'tasks.get'(ref: TaskRunRef): TaskRun | null
  /** Lists distinct operation types available in history for the native filter. */
  'tasks.types'(): readonly string[]
  /** Waits for a terminal record independently of the underlying execution. */
  'tasks.wait'(ref: TaskRunRef): TaskTerminalRun
  /** Acquires an ordered, lightweight task observation for this document. */
  'tasks.observe'(ref: TaskRunRef): string
  /** Requests a pause at the next business checkpoint. */
  'tasks.pause'(ref: TaskRunRef): TaskState
  /** Releases a reached pause or withdraws a pending one. */
  'tasks.resume'(ref: TaskRunRef): TaskState
  /** Requests cancellation and returns the acknowledged control state. */
  'tasks.cancel'(ref: TaskRunRef): TaskState
  /** Clears matching finished history while protecting admitted runs. */
  'tasks.clear'(filter: TaskHistoryFilter): number
  /** Lists available theme identities with names resolved for this window. */
  'themes.list'(): readonly { ref: ThemeRef; name: string }[]
  /** Reads a complete theme definition without acquiring font files. */
  'themes.get'(ref: ThemeRef): Theme | null
  /** Creates a user theme and adopts any required private font copies atomically. */
  'themes.clone'(ref: ThemeRef, name: string): ThemeRef
  /** Creates an independent user theme with both color branches. */
  'themes.create'(input: UserThemeCreate): ThemeRef
  /** Compares the edited name and individual tokens before committing the theme. */
  'themes.update'(id: string, input: UserThemeUpdate): void
  /** Removes a user theme while retaining its fonts and saved selection references. */
  'themes.delete'(id: string): void
  /** Acquires the application preview for this document after validating its branch. */
  'themes.preview'(input: AppearancePreviewInput): string
  /** Updates the identified preview while its owning editor still holds it. */
  'themes.updatePreview'(id: string, input: AppearancePreviewInput): void
  /** Searches the user font collection one bounded interval at a time. */
  'fonts.list'(
    search: string,
    options: ListOptions,
  ): ListResult<Pick<Font, 'id' | 'name' | 'createdAt' | 'updatedAt'>>
  /** Reads the font name and its complete verified file set. */
  'fonts.get'(id: string): Font | null
  /** Lists distinct family names from the actual operating-system font catalog. */
  'fonts.system'(): readonly string[]
  /** Prepares selected native files for this editor and returns null on cancellation. */
  'fonts.choose'(): readonly FontChoice[] | null
  /** Consumes a document-owned file stream and returns a verified font preview. */
  'fonts.prepareInput'(id: string): FontChoice
  /** Commits the chosen name and the verified files held by this document. */
  'fonts.import'(name: string, files: readonly string[]): Font
  /** Commits a validated name or retained-file edit against its original values. */
  'fonts.update'(
    id: string,
    input: {
      changes: { name?: string; files?: readonly { attachmentId: string }[] }
      expected?: NonNullable<FontUpdate['expected']>
    },
  ): Font
  /** Resolves retained and newly prepared files before committing the edited font. */
  'fonts.editFiles'(
    id: string,
    name: string,
    retained: readonly string[],
    added: readonly string[],
    original: Font,
  ): Font
  /** Deletes the font record and removes its references to attachment bytes. */
  'fonts.delete'(id: string): void
  /** Prepares a user-selected image and binds its preview to this document. */
  'images.choose'(): ImageChoice | null
  /** Consumes selected browser bytes into a verified and scoped image preview. */
  'images.prepareInput'(id: string): ImageChoice
  /** Applies the selected transforms to a held image and returns a new preparation. */
  'images.transform'(id: string, input: ImageTransform): ImageChoice
  /** Reads system registration and the actual current and next data locations. */
  'system.get'(): SystemIntegrationState
  /** Applies a login-item choice and rereads the operating-system state. */
  'system.login'(enable: boolean): LoginItemState
  /** Requests protocol registration and reads the resulting handler association. */
  'system.protocol'(): ProtocolIntegrationState
  /** Registers the movable Linux desktop entry when supported. */
  'system.desktopEntry'(): DesktopEntryState
  /** Opens the operating-system settings for the selected integration. */
  'system.settings'(target: 'loginItem' | 'protocol'): void
  /** Prepares the explicitly selected data location for the next launch. */
  'system.portable'(change: DataModeChange): DataLocationState
  /** Reads the shareable version, operating system and process architecture. */
  'app.environment'(): ApplicationEnvironment
  /** Copies the shareable environment fields to the system clipboard. */
  'app.copyEnvironment'(): void
}
