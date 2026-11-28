import type { WindowKind } from './protocol'
import type { LibraryWindowApi } from './library'
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

export interface FontChoice {
  id: string
  attachmentId: string
  url: string
  metadata: FontFileMetadata
}

export type FontFileChoice = { name: string; file: FontChoice } | { name: string; error: string }

export interface OpenedFont {
  hold: string
  font: Font
  urls: Readonly<Record<string, string>>
}

export interface ImageChoice {
  id: string
  attachmentId: string
  width: number
  height: number
  format: ImageFormat
  frameCount: number
  url: string
}

export interface WindowTranslation {
  locale: string
  messages: MessageCatalog
}

export interface WindowState {
  applicationName: string
  startupDeadline: number
  kind: WindowKind
  platform: DesktopPlatform
  buildId: string

  titlebarHeight: number | null
  translation: WindowTranslation
}

export interface WindowApi {
  'appearance.base'(): ViewAppearance
  'window.ready'(): void
  'window.state'(): WindowState

  'appearance.get'(): {
    value: ViewAppearance
    fontFamilies: Partial<Record<FontTokenName, string>>
    issues: readonly AppearanceIssue[]
    hold: string
  }

  'resources.release'(id: string): void
}

export interface MainWindowApi extends WindowApi, LibraryWindowApi {
  'window.reveal'(): void
  'window.caption'(background: string, foreground: string): void
  'app.restart'(): void
  'app.cancelExit'(): void
  'app.exitState'(): ApplicationExitState

  'preferences.get'(): PreferencesSnapshot
  'preferences.fields'(): readonly PreferenceField[]
  'preferences.defaults'(): Preferences
  'preferences.update'(input: PreferencesUpdate): PreferencesSnapshot
  'translations.list'(): readonly UiTranslation[]
  'network.state'(): NetworkState

  'tasks.list'(query: TaskQuery, options: ListOptions): ListResult<TaskRunSummary>
  'tasks.get'(ref: TaskRunRef): TaskRun | null
  'tasks.types'(): readonly string[]
  'tasks.wait'(ref: TaskRunRef): TaskTerminalRun
  'tasks.observe'(ref: TaskRunRef): string
  'tasks.pause'(ref: TaskRunRef): TaskState
  'tasks.resume'(ref: TaskRunRef): TaskState
  'tasks.cancel'(ref: TaskRunRef): TaskState
  'tasks.clear'(): number
  'tasks.delete'(ref: TaskRunRef): number

  'themes.list'(): readonly { ref: ThemeRef; name: string }[]
  'themes.get'(ref: ThemeRef): Theme | null
  'themes.clone'(ref: ThemeRef, name: string): ThemeRef
  'themes.create'(input: UserThemeCreate): ThemeRef
  'themes.update'(id: string, input: UserThemeUpdate): void
  'themes.delete'(id: string): void
  'themes.preview'(request: string, input: AppearancePreviewInput): string
  'themes.updatePreview'(id: string, input: AppearancePreviewInput): void

  'fonts.list'(
    search: string,
    options: ListOptions,
  ): ListResult<Pick<Font, 'id' | 'name' | 'createdAt' | 'updatedAt'>>
  'fonts.name'(id: string): string | null
  'fonts.get'(id: string): Font | null
  'fonts.open'(id: string): OpenedFont
  'fonts.system'(): readonly string[]
  'fonts.choose'(): readonly FontFileChoice[] | null
  'fonts.prepareInput'(id: string): FontChoice
  'fonts.import'(name: string, files: readonly string[]): Font
  'fonts.update'(
    id: string,
    input: {
      changes: { name?: string; files?: readonly { attachmentId: string }[] }
      expected?: NonNullable<FontUpdate['expected']>
    },
  ): Font
  'fonts.editFiles'(
    id: string,
    name: string,
    retained: readonly string[],
    added: readonly string[],
    original: Font,
  ): Font
  'fonts.delete'(id: string): void

  'images.choose'(): ImageChoice | null
  'images.prepareInput'(id: string): ImageChoice
  'images.transform'(id: string, input: ImageTransform): ImageChoice

  'system.get'(): SystemIntegrationState
  'system.login'(enable: boolean): LoginItemState
  'system.protocol'(): ProtocolIntegrationState
  'system.desktopEntry'(): DesktopEntryState
  'system.settings'(target: 'loginItem' | 'protocol'): void
  'system.portable'(change: DataModeChange): DataLocationState

  'app.environment'(): ApplicationEnvironment
  'app.copyEnvironment'(): void
}
