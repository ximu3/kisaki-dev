/** @fileoverview Describes a single ordered message channel bound to one peer by its host. */

import type { RpcFrame } from './frames'

/** The connection owns this transport from start until close. Use a fresh one for each peer lifetime. */
export interface RpcTransport {
  /** Install listeners before delivering any queued frames. Report channel loss or async send errors via closed. */
  start(receive: (input: unknown) => void, closed: (cause?: unknown) => void): void
  /** Hand off a complete frame in order, or throw if the channel cannot accept it. */
  send(frame: RpcFrame): void
  /** Remove listeners and release the channel, preserving the order of already handed-off frames and close. */
  close(): void
}
