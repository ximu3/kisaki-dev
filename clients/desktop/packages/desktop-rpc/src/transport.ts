import type { RpcFrame } from './frames'

export interface RpcTransport {
  start(receive: (input: unknown) => void, closed: (cause?: unknown) => void): void

  send(frame: RpcFrame): void

  close(): void
}
