/** Private process lifecycle messages. Extension API traffic is a separate protocol. */
export type HostControl = { type: 'stop' }

/** Sent only after the process has attached its stop handler. */
export type HostStatus = { type: 'ready' }
