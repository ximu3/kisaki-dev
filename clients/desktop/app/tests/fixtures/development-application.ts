import {
  developmentProtocolVersion,
  parseDevelopmentCommand,
} from '@kisaki3/desktop-contracts/development'

let requests = 0
process.on('message', (value: unknown) => {
  const message = parseDevelopmentCommand(value)
  if (message.type === 'initialize') {
    process.send?.({
      type: 'ready',
      protocolVersion: process.argv.includes('--wrong-version') ? 99 : developmentProtocolVersion,
      appVersion: 'fixture',
      apiVersion: null,
      buildId: 'fixture',
    })
  } else if (message.type === 'stop') {
    requests++
    process.send?.(
      { type: 'stopResult', outcome: requests === 1 ? 'cancelled' : 'exiting' },
      () => {
        // Connection closure and process exit are separate lifecycle events.
        if (requests === 2) process.disconnect()
      },
    )
  }
})
