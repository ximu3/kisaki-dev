/** @fileoverview Describes a single ordered message channel bound to one peer by its host. */

import type { RpcFrame } from './frames'

/** One ordered channel bound to a single peer and owned by its RPC connection. */
export interface RpcTransport {
  /**
   * Installs receive and loss callbacks before delivering queued frames.
   *
   * Reports channel loss and asynchronous send failures through closed.
   */
  start(receive: (input: unknown) => void, closed: (cause?: unknown) => void): void

  /** Hands a complete frame to the channel in order, or throws when handoff fails. */
  send(frame: RpcFrame): void

  /**
   * Removes listeners and releases the owned channel.
   *
   * Preserves ordering between previously handed-off frames and channel closure.
   */
  close(): void
}
