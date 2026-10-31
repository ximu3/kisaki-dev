/** @fileoverview Exposes versioned SDK handshake values; actual host and resource adaptation belongs to its runtime implementation. */

export {
  extensionApiVersion,
  extensionNodeProtocol,
  extensionWebviewProtocol,
  parseApiHello,
  parseNodeAccepted,
  parseWebviewAccepted,
  requireCompatibleApi,
} from './values'
export type { ApiHello, NodeAccepted, WebviewAccepted } from './values'
