/** @fileoverview Generated from en/index.ts by generate:messages. Do not edit the call contract independently. */

/** Argument objects keyed by English messages; argument-free calls use the never type. */
export interface MessageArguments {
  readonly "actions.save": never
  readonly "actions.cancel": never
  readonly "actions.close": never
  readonly "actions.create": never
  readonly "actions.delete": never
  readonly "actions.retry": never
  readonly "actions.edit": never
  readonly "actions.open": never
  readonly "library.types.game": never
  readonly "library.types.anime": never
  readonly "library.types.comic": never
  readonly "library.types.novel": never
  readonly "library.types.character": never
  readonly "library.types.person": never
  readonly "library.types.organization": never
  readonly "library.parts.novelVolume": never
  readonly "library.parts.comicVolume": never
  readonly "library.parts.comicChapter": never
  readonly "library.parts.animeEpisode": never
  readonly "library.parts.animeExtra": never
  readonly "library.status.planned": never
  readonly "library.status.active": never
  readonly "library.status.onHold": never
  readonly "library.status.unset": never
  readonly "library.selection": { readonly "count": number }
  readonly "library.noMatch": never
  readonly "library.conflict": never
  readonly "library.completion.recorded": { readonly "name": string | number }
  readonly "library.completion.unknownDate": never
  readonly "tasks.running": never
  readonly "tasks.pausing": never
  readonly "tasks.paused": never
  readonly "tasks.cancelling": never
  readonly "tasks.completed": never
  readonly "tasks.failed": never
  readonly "tasks.cancelled": never
  readonly "tasks.interrupted": never
  readonly "resources.unavailable": never
  readonly "resources.captureUnavailable": never
  readonly "scanner.presets.bracketBoth.name": never
  readonly "scanner.presets.bracketBoth.description": never
  readonly "scanner.presets.multiBracketPrefix.name": never
  readonly "scanner.presets.multiBracketPrefix.description": never
  readonly "scanner.presets.releaseYearSuffix.name": never
  readonly "scanner.presets.releaseYearSuffix.description": never
  readonly "scanner.presets.versionSuffix.name": never
  readonly "scanner.presets.versionSuffix.description": never
  readonly "scanner.presets.languageSuffix.name": never
  readonly "scanner.presets.languageSuffix.description": never
  readonly "scanner.presets.bracketPrefix.name": never
  readonly "scanner.presets.bracketPrefix.description": never
  readonly "scanner.presets.parenPrefix.name": never
  readonly "scanner.presets.parenPrefix.description": never
  readonly "scanner.presets.bracketSuffix.name": never
  readonly "scanner.presets.bracketSuffix.description": never
  readonly "scanner.presets.parenSuffix.name": never
  readonly "scanner.presets.parenSuffix.description": never
  readonly "showcase.presets.recentlyUsed.name": never
  readonly "showcase.presets.recentlyUsed.description": never
  readonly "showcase.presets.active.name": never
  readonly "showcase.presets.active.description": never
  readonly "showcase.presets.planned.name": never
  readonly "showcase.presets.planned.description": never
  readonly "showcase.presets.recentlyAdded.name": never
  readonly "showcase.presets.recentlyAdded.description": never
  readonly "showcase.presets.favoriteWorks.name": never
  readonly "showcase.presets.favoriteWorks.description": never
  readonly "showcase.presets.rating.name": never
  readonly "showcase.presets.rating.description": never
  readonly "showcase.presets.favoriteCharacters.name": never
  readonly "showcase.presets.favoriteCharacters.description": never
  readonly "showcase.presets.favoritePersons.name": never
  readonly "showcase.presets.favoritePersons.description": never
  readonly "showcase.presets.favoriteOrganizations.name": never
  readonly "showcase.presets.favoriteOrganizations.description": never
  readonly "showcase.presets.collections.name": never
  readonly "showcase.presets.collections.description": never
}

/** Key of one message in the English authoring baseline. */
export type MessageKey = keyof MessageArguments

/** Correlated key and argument tuples for one complete translation call. */
export type TranslationCall = { [K in MessageKey]: MessageArguments[K] extends never ? [key: K] : [key: K, values: MessageArguments[K]] }[MessageKey]

/** Typed message formatter returning plain text with literal markup. */
export type Translate = (...args: TranslationCall) => string
