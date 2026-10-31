/** @fileoverview Generated message arguments from the English catalog; run pnpm generate:messages to update. */

export interface MessageParameters {
  readonly 'window.close': Record<never, never>
  readonly 'window.closeFailed': Record<never, never>
  readonly 'windows.gamePanel': Record<never, never>
  readonly 'windows.main': Record<never, never>
  readonly 'windows.player': Record<never, never>
  readonly 'windows.reader': Record<never, never>
}

export type MessageKey = keyof MessageParameters
export type MessageCall = {
  [Key in MessageKey]: keyof MessageParameters[Key] extends never
    ? [key: Key]
    : [key: Key, values: MessageParameters[Key]]
}[MessageKey]
export type Translate = (...input: MessageCall) => string
