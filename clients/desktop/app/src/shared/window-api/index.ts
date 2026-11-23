import type { WindowKind } from './protocol'
import type { FontTokenName } from '@kisaki3/desktop-appearance/tokens'
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

/** One native file choice with its per-file outcome. */
export type FontFileChoice = { name: string; file: FontChoice } | { name: string; error: string }

/** Saved font and the document-owned URLs for its attachment snapshot. */
export interface OpenedFont {
  hold: string
  font: Font
  urls: Readonly<Record<string, string>>
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

  /** Requested height of the main window title bar in DIP, or null for other windows. */
  titlebarHeight: number | null
  locale: string
  messages: MessageCatalog
}

/** Shared operations available to all four native windows. */
export interface WindowApi {
  /** Reads the palette and scale available before document font loading finishes. */
  'appearance.base'(): ViewAppearance
  /** Acknowledges that this document can receive navigation and close requests. */
  'window.ready'(): void
  'window.state'(): WindowState

  /** Resolves the effective branch and acquires font URLs for this document. */
  'appearance.get'(): {
    value: ViewAppearance
    fontFamilies: Partial<Record<FontTokenName, string>>
    issues: readonly AppearanceIssue[]
    hold: string
  }

  /** Releases the identified hold in this document without affecting other readers. */
  'resources.release'(id: string): void
}

/** The main window's settings, task center and native management capabilities. */
export interface MainWindowApi extends WindowApi {
  /** Restores and focuses the window when a pending decision requires user input. */
  'window.reveal'(): void
  /** Applies the document's resolved colors to this window's controls overlay. */
  'window.caption'(background: string, foreground: string): void
  /** Restarts the application after the normal close workflow succeeds. */
  'app.restart'(): void
  /** Cancels a pending exit while preserving work already completed. */
  'app.cancelExit'(): void
  /** Reads current exit progress without starting a new attempt. */
  'app.exitState'(): ApplicationExitState

  'preferences.get'(): PreferencesSnapshot
  'preferences.fields'(): readonly PreferenceField[]
  'preferences.defaults'(): Preferences
  'preferences.update'(input: PreferencesUpdate): PreferencesSnapshot
  /** Lists built-in and registered translations by stable identity. */
  'translations.list'(): readonly UiTranslation[]
  'network.state'(): NetworkState

  'tasks.list'(query: TaskQuery, options: ListOptions): ListResult<TaskRunSummary>
  'tasks.get'(ref: TaskRunRef): TaskRun | null
  /** Lists distinct operation types available in history for the native filter. */
  'tasks.types'(): readonly string[]
  /** Waits for a terminal record independently of the underlying execution. */
  'tasks.wait'(ref: TaskRunRef): TaskTerminalRun
  /** Acquires an ordered, lightweight task observation for this document. */
  'tasks.observe'(ref: TaskRunRef): string
  'tasks.pause'(ref: TaskRunRef): TaskState
  'tasks.resume'(ref: TaskRunRef): TaskState
  'tasks.cancel'(ref: TaskRunRef): TaskState
  /** Clears all finished history while protecting admitted runs. */
  'tasks.clear'(): number
  'tasks.delete'(ref: TaskRunRef): number

  /** Lists available theme identities with names resolved for this window. */
  'themes.list'(): readonly { ref: ThemeRef; name: string }[]
  'themes.get'(ref: ThemeRef): Theme | null
  /** Creates a user theme and adopts any required private font copies atomically. */
  'themes.clone'(ref: ThemeRef, name: string): ThemeRef
  'themes.create'(input: UserThemeCreate): ThemeRef
  'themes.update'(id: string, input: UserThemeUpdate): void
  /** Removes a user theme while retaining its fonts and saved selection references. */
  'themes.delete'(id: string): void
  /** Acquires the application preview for this document after validating its branch. */
  'themes.preview'(request: string, input: AppearancePreviewInput): string
  /** Updates the identified preview while its owning editor still holds it. */
  'themes.updatePreview'(id: string, input: AppearancePreviewInput): void

  /** Searches the user font collection one bounded interval at a time. */
  'fonts.list'(
    search: string,
    options: ListOptions,
  ): ListResult<Pick<Font, 'id' | 'name' | 'createdAt' | 'updatedAt'>>
  'fonts.get'(id: string): Font | null
  /** Binds the saved font's exact files as a document-owned preview. */
  'fonts.open'(id: string): OpenedFont
  /** Lists distinct family names from the actual operating-system font catalog. */
  'fonts.system'(): readonly string[]
  /** Reports each selected file's preparation outcome or null on picker cancellation. */
  'fonts.choose'(): readonly FontFileChoice[] | null
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
  'system.desktopEntry'(): DesktopEntryState
  'system.settings'(target: 'loginItem' | 'protocol'): void
  /** Prepares the explicitly selected data location for the next launch. */
  'system.portable'(change: DataModeChange): DataLocationState

  'app.environment'(): ApplicationEnvironment
  'app.copyEnvironment'(): void
}
