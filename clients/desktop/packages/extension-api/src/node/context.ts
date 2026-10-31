/** @fileoverview Selects the finite extension Node surface and binds contribution differences to the actual activating instance. */

import type {
  AppearanceApi,
  AppearanceTokens,
  ThemeRegistration,
} from '@kisaki3/desktop-contracts/appearance'
import type { ExtensionDeeplinkRequest } from '@kisaki3/desktop-contracts/deeplink'
import type { EventsApi, EventPublisher } from '@kisaki3/desktop-contracts/events'
import type {
  AsyncDisposable,
  CallOptions,
  Disposable,
  ExecutionContext,
  Registration,
} from '@kisaki3/desktop-contracts/execution'
import type { FontsApi } from '@kisaki3/desktop-contracts/fonts'
import type { I18nApi, MessageCatalog, UiTranslationRef } from '@kisaki3/desktop-contracts/i18n'
import type { ImagesApi } from '@kisaki3/desktop-contracts/images'
import type { IngestApi } from '@kisaki3/desktop-contracts/ingest'
import type { LibraryApi } from '@kisaki3/desktop-contracts/library'
import type {
  FieldProcessor as NativeFieldProcessor,
  MetadataApi,
  MetadataProvider as NativeMetadataProvider,
} from '@kisaki3/desktop-contracts/metadata'
import type { NetworkApi } from '@kisaki3/desktop-contracts/network'
import type { PreferencesApi } from '@kisaki3/desktop-contracts/preferences'
import type {
  ScannerApi,
  WorkRecognizer as NativeWorkRecognizer,
} from '@kisaki3/desktop-contracts/scanner'
import type { SearchApi } from '@kisaki3/desktop-contracts/search'
import type { SessionsApi } from '@kisaki3/desktop-contracts/sessions'
import type { TasksApi } from '@kisaki3/desktop-contracts/tasks'
import type {
  DialogDefinition,
  MenusApi,
  NodeView,
  NotificationsApi,
  PageDefinition,
  PageRef,
  PrivateMethod,
  UiApi,
} from '@kisaki3/desktop-contracts/ui'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { StorageApi } from './storage'

/** An explicit selection prevents new native capabilities from becoming extension API merely by being added to the application. */
export interface ExtensionLibraryApi {
  readonly entries: Pick<
    LibraryApi['entries'],
    | 'list'
    | 'get'
    | 'getDescription'
    | 'locate'
    | 'groups'
    | 'selectRefs'
    | 'findByExternalIdentity'
    | 'create'
    | 'update'
    | 'updateMany'
    | 'setEvaluation'
    | 'setWorkStatus'
    | 'bindExternalIdentity'
    | 'unbindExternalIdentity'
    | 'merge'
    | 'delete'
  >
  readonly parts: Pick<
    LibraryApi['parts'],
    | 'list'
    | 'get'
    | 'create'
    | 'update'
    | 'delete'
    | 'merge'
    | 'changeKind'
    | 'reorder'
    | 'move'
    | 'setCompleted'
    | 'setCompletedMany'
  > & {
    readonly volumeChapters: Pick<
      LibraryApi['parts']['volumeChapters'],
      'list' | 'update' | 'setNumberLabel' | 'reorder' | 'move'
    >
  }
  readonly completions: Pick<
    LibraryApi['completions'],
    | 'list'
    | 'get'
    | 'statistics'
    | 'create'
    | 'createMany'
    | 'recordCurrent'
    | 'recordCurrentMany'
    | 'update'
    | 'delete'
  >
  readonly relations: {
    readonly [
      Kind in 'workCharacters' | 'personWorks' | 'organizationWorks' | 'workRelations'
    ]: Pick<
      LibraryApi['relations'][Kind],
      'list' | 'get' | 'create' | 'update' | 'delete' | 'reorder' | 'move'
    >
  }
  readonly collections: Pick<
    LibraryApi['collections'],
    | 'list'
    | 'get'
    | 'create'
    | 'update'
    | 'delete'
    | 'merge'
    | 'reorder'
    | 'move'
    | 'convertToManual'
  > & {
    readonly members: Pick<
      LibraryApi['collections']['members'],
      'applyChanges' | 'update' | 'reorder' | 'move'
    >
  }
  readonly tags: Pick<
    LibraryApi['tags'],
    'list' | 'get' | 'create' | 'update' | 'delete' | 'merge'
  > & {
    readonly entries: Pick<
      LibraryApi['tags']['entries'],
      'applyChanges' | 'update' | 'reorder' | 'move'
    >
  }
  readonly notes: Pick<LibraryApi['notes'], 'list' | 'get' | 'create' | 'update' | 'delete'> & {
    readonly entries: Pick<LibraryApi['notes']['entries'], 'applyChanges' | 'reorder' | 'move'>
  }
  readonly annotations: Pick<
    LibraryApi['annotations'],
    'list' | 'get' | 'create' | 'update' | 'delete' | 'listLocations'
  >
  readonly activities: Pick<
    LibraryApi['activities'],
    'list' | 'get' | 'statistics' | 'create' | 'update' | 'delete'
  >
  readonly holdings: Pick<
    LibraryApi['holdings'],
    'registerLocalContent' | 'refresh' | 'reidentify' | 'onInvalidated'
  > & {
    readonly directories: Pick<
      LibraryApi['holdings']['directories'],
      'list' | 'get' | 'create' | 'update' | 'delete' | 'relocate'
    >
    readonly files: Pick<
      LibraryApi['holdings']['files'],
      | 'list'
      | 'get'
      | 'create'
      | 'update'
      | 'delete'
      | 'setAssociations'
      | 'setAssociationMode'
      | 'setPreferred'
      | 'setPreferredMany'
      | 'reorder'
      | 'relocate'
      | 'merge'
      | 'setPlaybackPosition'
      | 'setReadingPosition'
      | 'updatePlaybackSettings'
      | 'setEncoding'
    >
    readonly launchConfigs: Pick<
      LibraryApi['holdings']['launchConfigs'],
      'list' | 'get' | 'create' | 'update' | 'delete' | 'setPreferred' | 'reorder'
    >
    readonly recognitionProfiles: Pick<
      LibraryApi['holdings']['recognitionProfiles'],
      | 'list'
      | 'get'
      | 'create'
      | 'update'
      | 'delete'
      | 'reorder'
      | 'listPresets'
      | 'listDirectories'
      | 'onInvalidated'
    >
    readonly preferences: Pick<LibraryApi['holdings']['preferences'], 'get' | 'update'>
    readonly backups: Pick<
      LibraryApi['holdings']['backups'],
      | 'list'
      | 'get'
      | 'create'
      | 'restore'
      | 'lock'
      | 'unlock'
      | 'updateNote'
      | 'delete'
      | 'onInvalidated'
    > & {
      readonly recoveries: Pick<
        LibraryApi['holdings']['backups']['recoveries'],
        'list' | 'get' | 'inspect' | 'resolve' | 'remove'
      >
    }
  }
  readonly showcase: Pick<
    LibraryApi['showcase'],
    'list' | 'listPresets' | 'applyChanges' | 'onInvalidated'
  >
  readonly writeGraph: LibraryApi['writeGraph']
  readonly onInvalidated: LibraryApi['onInvalidated']
}

/** The author supplies a local ID; the host supplies the qualified identity visible in catalogs. */
export interface MetadataProvider extends Omit<NativeMetadataProvider, 'id'> {
  readonly id: string
}
/** A local processor definition retains the native field and result contract. */
export interface FieldProcessor extends Omit<NativeFieldProcessor, 'id'> {
  readonly id: string
}
/** A local recognizer definition retains native boundary and evidence semantics. */
export interface WorkRecognizer extends Omit<NativeWorkRecognizer, 'id'> {
  readonly id: string
}
/** Registration IDs are local to this extension; all other business input/result semantics remain native. */
export interface ExtensionMetadataApi extends Pick<
  MetadataApi,
  'search' | 'searchImages' | 'fetch'
> {
  readonly providers: Pick<MetadataApi['providers'], 'list' | 'get' | 'onInvalidated'> & {
    /** Bind the local provider ID to this actual extension and publish only after successful activation. */
    register(provider: MetadataProvider, call?: CallOptions): Promise<Registration<string>>
  }
  readonly fieldProcessors: Pick<
    MetadataApi['fieldProcessors'],
    'list' | 'get' | 'onInvalidated'
  > & {
    /** Bind the local processor ID; processing remains field-limited and independently cancellable. */
    register(processor: FieldProcessor, call?: CallOptions): Promise<Registration<string>>
  }
  readonly profiles: Pick<
    MetadataApi['profiles'],
    'list' | 'get' | 'create' | 'update' | 'delete' | 'reorder' | 'listPresets' | 'onInvalidated'
  >
}
export interface ExtensionScannerApi extends Pick<
  ScannerApi,
  'preview' | 'scan' | 'getState' | 'observe'
> {
  readonly configs: Pick<
    ScannerApi['configs'],
    'list' | 'get' | 'create' | 'update' | 'delete' | 'reorder' | 'excludePath' | 'onInvalidated'
  >
  readonly runs: Pick<ScannerApi['runs'], 'list' | 'get' | 'clear' | 'onInvalidated'>
  readonly recognizers: Pick<ScannerApi['recognizers'], 'list' | 'get' | 'onInvalidated'> & {
    /** Bind this local recognizer ID; registration does not select it in any saved scan definition. */
    register(recognizer: WorkRecognizer, call?: CallOptions): Promise<Registration<string>>
  }
}
export interface ExtensionSessionsApi extends Pick<
  SessionsApi,
  'list' | 'get' | 'observeAll' | 'observe'
> {
  readonly game: Pick<
    SessionsApi['game'],
    'open' | 'pauseTiming' | 'resumeTiming' | 'focus' | 'close' | 'terminate' | 'captureImage'
  >
  readonly anime: Pick<
    SessionsApi['anime'],
    | 'open'
    | 'switchFile'
    | 'pauseTiming'
    | 'resumeTiming'
    | 'focus'
    | 'close'
    | 'play'
    | 'pause'
    | 'seek'
    | 'setSpeed'
    | 'setVolume'
    | 'setMuted'
    | 'setSubtitlesVisible'
    | 'setSubtitleScale'
    | 'setAudioDelay'
    | 'setSubtitleDelay'
    | 'getTracks'
    | 'observeTracks'
    | 'selectTrack'
    | 'captureImage'
  >
  readonly comic: Pick<
    SessionsApi['comic'],
    'open' | 'switchFile' | 'pauseTiming' | 'resumeTiming' | 'focus' | 'close' | 'seek'
  >
  readonly novel: Pick<
    SessionsApi['novel'],
    'open' | 'switchFile' | 'pauseTiming' | 'resumeTiming' | 'focus' | 'close' | 'seek'
  >
}
export interface ThemeContribution {
  readonly id: string
  readonly name: LocalizedText
  readonly light: AppearanceTokens
  readonly dark: AppearanceTokens
}
export interface TranslationContribution {
  readonly id: string
  readonly locale: string
  readonly name: LocalizedText
  readonly messages: MessageCatalog
}
export type ExtensionPageDefinition<
  Methods extends { [Key in keyof Methods]: PrivateMethod } = Record<string, PrivateMethod>,
  Notices extends object = Record<string, unknown>,
> = Omit<PageDefinition<Methods, Notices>, 'ref'> & { readonly id: string }
export interface ExtensionUiApi extends Pick<UiApi, 'navigate' | 'openExternal'> {
  readonly menus: Pick<MenusApi, 'add'>
  readonly pages: {
    /** Register a stable local page; the host supplies extension ownership and validates its document root. */
    register<
      Methods extends { [Key in keyof Methods]: PrivateMethod } = Record<string, PrivateMethod>,
      Notices extends object = Record<string, unknown>,
    >(
      definition: ExtensionPageDefinition<Methods, Notices>,
      call?: CallOptions,
    ): Promise<Registration<Extract<PageRef, { type: 'extension' }>>>
    /** Open/reuse this extension's page and await interactive readiness, without repeating setup on reuse. */
    open<
      Methods extends { [Key in keyof Methods]: PrivateMethod } = Record<string, PrivateMethod>,
      Notices extends object = Record<string, unknown>,
    >(
      input: { readonly pageId: string },
      call?: CallOptions,
    ): Promise<NodeView<Methods, Notices>>
  }
  readonly dialogs: {
    /** Open one independent temporary view; setup and resource lifetimes follow the native dialog contract. */
    open<
      Methods extends { [Key in keyof Methods]: PrivateMethod } = Record<string, PrivateMethod>,
      Notices extends object = Record<string, unknown>,
    >(
      definition: DialogDefinition<Methods, Notices>,
      call?: CallOptions,
    ): Promise<NodeView<Methods, Notices>>
  }
}
export interface ExtensionAppearanceApi {
  readonly themes: Pick<
    AppearanceApi['themes'],
    'list' | 'get' | 'create' | 'clone' | 'update' | 'delete' | 'open' | 'onInvalidated'
  > & {
    /** Publish a complete local theme contribution owned by this instance. */
    register(theme: ThemeContribution, call?: CallOptions): Promise<ThemeRegistration>
  }
}
export interface ExtensionI18nApi {
  readonly locale: Pick<I18nApi['locale'], 'get' | 'onChanged'>
  readonly translations: Pick<I18nApi['translations'], 'list' | 'onInvalidated'> & {
    /** Validate and publish a local translation identity using the sole desktop English contract. */
    register(
      definition: TranslationContribution,
      call?: CallOptions,
    ): Promise<Registration<UiTranslationRef>>
  }
}
export interface ExtensionEventsApi extends Pick<EventsApi, 'on'> {
  /** Define one event under this actual instance's extension prefix; native event names cannot be claimed. */
  define<Payload>(localId: string, call?: CallOptions): Promise<EventPublisher<Payload>>
}
/** One activation's verified identity and directories; none of these values can authorize another running instance. */
export interface ExtensionIdentity {
  readonly id: string
  readonly version: string
  readonly defaultLocale: string
}
export interface ExtensionPaths {
  readonly package: string
  readonly data: string
  readonly cache: string
}
export interface ExtensionContext {
  readonly extension: ExtensionIdentity
  readonly paths: ExtensionPaths
  readonly library: ExtensionLibraryApi
  readonly metadata: ExtensionMetadataApi
  readonly ingest: Pick<IngestApi, 'add' | 'update' | 'addMany' | 'updateMany'>
  readonly scanner: ExtensionScannerApi
  readonly sessions: ExtensionSessionsApi
  readonly tasks: Pick<
    TasksApi,
    | 'run'
    | 'list'
    | 'get'
    | 'observe'
    | 'onInvalidated'
    | 'wait'
    | 'pause'
    | 'resume'
    | 'cancel'
    | 'clearHistory'
  >
  readonly appearance: ExtensionAppearanceApi
  readonly fonts: Pick<
    FontsApi,
    | 'list'
    | 'get'
    | 'listSystem'
    | 'prepare'
    | 'import'
    | 'update'
    | 'delete'
    | 'open'
    | 'onInvalidated'
  >
  readonly preferences: Pick<PreferencesApi, 'get' | 'getDefaults' | 'update' | 'onInvalidated'>
  readonly search: Pick<SearchApi, 'query'>
  readonly images: Pick<ImagesApi, 'prepare' | 'transform'>
  readonly network: Pick<NetworkApi, 'fetch'>
  readonly notifications: Pick<NotificationsApi, 'show'>
  readonly ui: ExtensionUiApi
  readonly i18n: ExtensionI18nApi
  readonly events: ExtensionEventsApi
  readonly storage: StorageApi
  readonly deeplink: {
    /** Register this extension's sole external handler; each request keeps decoded ordering and its independently cancelled execution. */
    register(
      handler: (
        request: ExtensionDeeplinkRequest,
        execution: ExecutionContext,
      ) => void | Promise<void>,
      call?: CallOptions,
    ): Promise<AsyncDisposable>
  }
  /** Register actual instance cleanup; callbacks may be asynchronous and never transfer to a later activation. */
  onDispose(cleanup: () => void | Promise<void>): Disposable
}
/** The host calls this ordinary named export with one bound context; registration is published only after activation succeeds. */
export interface ExtensionModule {
  activate(context: ExtensionContext): void | Promise<void>
}
