# RPC connections

Bind one ordered transport to one peer and one `RpcConnection`. Register its receive and loss callbacks before delivering queued frames. A transport can deliver a reply synchronously during `send`; report a failed asynchronous send through the loss callback. Closing the transport releases the channel and its listeners.

## Establishing a connection

Wait for `connection.ready` to obtain the verified peer context. The acceptor compares protocol name and version and validates the initiating context against the identity bound to the transport. The initiator can also reject the accepted context. The handshake has a ten-second deadline. An unsuccessful handshake rejects `ready` and resolves `closed` with the local reason. A new connection starts a new lifetime.

## Requests and notifications

Use `request` for work whose result matters. Arguments are finite JSON data. An omitted success value means `void`, while an explicit `null` survives delivery. Both directions can issue calls at the same time, including from inside a handler. Each direction allocates its own request IDs. Handlers validate business inputs and permissions and settle after their work and cleanup finish.

An already-aborted signal rejects a request before transmission with `Cancelled`. After transmission, abort asks the peer to stop. The promise still waits for the peer's outcome and can succeed. Losing the connection rejects outstanding waits with `ConnectionClosed`. The peer might already have committed a write. Inspect its outcome before considering another request.

`notify` completes at local handoff. The receiver reports handler failures through its endpoint's notification error callback. Use a request when establishing or releasing a resource requires acknowledgement.

## Closing and errors

`close()` stops admission, rejects outbound waits, aborts inbound signals and releases the transport. Repeated closes have no further effect. Observe `closed` to release resources owned by the endpoint. Remote work may still be finishing.

Only the endpoint's own method and topic entries are dispatched. `RpcError` carries a public code and message. Keep credentials, stacks and local causes out of values sent to peers. A custom error codec is responsible for its method-specific data in both directions. `parseJsonValue` takes a detached snapshot and rejects cycles, sparse arrays, accessors, symbols and nonfinite numbers.
