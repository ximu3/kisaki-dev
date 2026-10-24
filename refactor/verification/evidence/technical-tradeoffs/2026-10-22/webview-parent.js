window.probeState = {
  status: 'running',
  nativePreload: window.nativeProbe?.mainFrame === true,
  reports: {},
  origins: {},
  connections: {},
  rejectedSources: 0
}
const ports = new Map()
window.addEventListener('message', (event) => {
  const id = ['a', 'b'].find((key) => document.getElementById(key).contentWindow === event.source)
  if (!id || event.origin !== `kisaki-extension://view-${id}` || event.data?.type !== 'ready') {
    window.probeState.rejectedSources += 1
    return
  }
  const channel = new MessageChannel()
  ports.get(id)?.close()
  ports.set(id, channel.port1)
  window.probeState.origins[id] = event.origin
  window.probeState.connections[id] = (window.probeState.connections[id] ?? 0) + 1
  channel.port1.onmessage = ({ data }) => {
    if (ports.get(id) !== channel.port1) return
    window.probeState.reports[id] = data
    if (data.failed) window.probeState.status = 'failed'
    if (window.probeState.reports.a?.reloaded && window.probeState.reports.b?.wrongResourceDenied) {
      const checks = window.probeState.initialA
      const valid = Object.values(checks ?? {}).every((value) => value === true)
      window.probeState.status =
        valid &&
        window.probeState.nativePreload &&
        window.probeState.connections.a === 2 &&
        window.probeState.rejectedSources > 0
          ? 'passed'
          : 'failed'
    }
    if (id === 'a' && data.checks) {
      window.probeState.initialA = data.checks
      channel.port1.postMessage({ type: 'navigate' })
    }
  }
  event.source.postMessage({ type: 'port' }, event.origin, [channel.port2])
})
