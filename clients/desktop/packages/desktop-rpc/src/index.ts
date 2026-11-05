/** @fileoverview Public entry for the environment-independent RPC connection and wire contract. */

export { RpcConnection } from './connection'
export type {
  RpcEndpoint,
  RpcErrorCodec,
  RpcHandshake,
  RpcMethod,
  RpcNotification,
} from './connection/endpoint'
export { RpcError } from './errors'
export { parseRpcFrame, rpcWireVersion, type RpcFrame, type RpcProtocol } from './frames'
export { parseJsonValue, type JsonValue } from './json'
export type { RpcTransport } from './transport'
