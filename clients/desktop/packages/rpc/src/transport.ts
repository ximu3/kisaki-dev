/**
 * @fileoverview Defines connection-owned message transport and subscription cleanup
 * contracts independently of platform APIs.
 */

/** A message channel owned by one connection; values still require frame validation. */
export interface MessageTransport {
  /** Send one message. Throwing means delivery could not be confirmed, not rollback. */
  send(message: unknown): void
  /** Attach a receiver and return an idempotent subscription release function. */
  onMessage(listener: (message: unknown) => void): () => void
  /** Observe closure; the connection releases pending calls and subscriptions. */
  onClose(listener: () => void): () => void
  /** Close this transport and release its underlying channel. */
  close(): void
}
