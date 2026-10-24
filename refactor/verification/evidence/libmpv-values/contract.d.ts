/** Design-only declarations; this file does not describe an implemented addon. */
export declare class MpvByteString {
  private readonly bytes
  constructor(bytes: Uint8Array)
  /** Return an independent copy of the native string bytes. */
  toBytes(): Uint8Array
}

export declare class MpvMapEntries {
  private readonly brand
  constructor(entries: readonly (readonly [MpvText, MpvValue])[])
  readonly entries: readonly (readonly [MpvText, MpvValue])[]
}

export type MpvText = string | MpvByteString

export interface MpvObject {
  readonly [key: string]: MpvValue
}

export type MpvMap = MpvObject | MpvMapEntries

export type MpvValue =
  | null
  | boolean
  | bigint
  | number
  | MpvText
  | Uint8Array
  | readonly MpvValue[]
  | MpvMap

/** Only the value shape is checked here, not screenshot layout or command execution. */
export interface ScreenshotRawResult extends MpvObject {
  readonly w: bigint
  readonly h: bigint
  readonly stride: bigint
  readonly format: 'bgr0' | 'bgra' | 'rgba' | 'rgba64'
  readonly data: Uint8Array
}
