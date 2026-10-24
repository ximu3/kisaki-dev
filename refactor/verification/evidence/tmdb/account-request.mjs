/** Isolated HTTPS transport used by the account verification probe. */
import * as tmdbHttps from 'node:https'

export function createVerificationClient(appToken) {
  return {
    appToken,
    records: [],
    agent: new tmdbHttps.Agent({ keepAlive: false }),
    request: async function (
      label,
      method,
      path,
      { token = this.appToken, body, query = {} } = {}
    ) {
      const endpoint = new URL(path, 'https://api.themoviedb.org')
      if (endpoint.origin !== 'https://api.themoviedb.org')
        throw new Error('Unexpected API origin.')
      for (const [key, value] of Object.entries(query))
        endpoint.searchParams.set(key, String(value))
      const payload = body === undefined ? null : Buffer.from(JSON.stringify(body))
      const entry = {
        label,
        method,
        endpoint: path
          .replace(/\/account\/[^/]+/, '/account/{id}')
          .replace(/\/list\/\d+/, '/list/{id}'),
        httpStatus: null
      }
      this.records.push(entry)
      return await new Promise((resolve, reject) => {
        const headers = {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json',
          'User-Agent': 'Kisaki-design-verification/1.0',
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': payload.length }
            : {})
        }
        const request = tmdbHttps.request(
          endpoint,
          { method, headers, agent: this.agent },
          (response) => {
            entry.httpStatus = response.statusCode
            const chunks = []
            let size = 0
            response.on('data', (chunk) => {
              size += chunk.length
              if (size > 4 * 1024 * 1024) {
                response.destroy()
                request.destroy()
              } else chunks.push(chunk)
            })
            response.on('end', () => {
              try {
                const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
                entry.providerStatus =
                  typeof parsed.status_code === 'number' ? parsed.status_code : null
                entry.success = typeof parsed.success === 'boolean' ? parsed.success : null
                resolve({ httpStatus: response.statusCode, data: parsed })
              } catch {
                entry.failure = 'responseFormat'
                reject(new Error('TMDB response format was not JSON.'))
              }
            })
            response.on('error', () => {
              entry.failure = 'responseTransport'
              reject(new Error('TMDB response stream failed.'))
            })
          }
        )
        request.setTimeout(20000, () => request.destroy(new Error('Request deadline elapsed.')))
        request.on('error', (error) => {
          entry.failure = typeof error.code === 'string' ? error.code : 'requestTransport'
          reject(new Error('TMDB request failed.'))
        })
        if (payload) request.write(payload)
        request.end()
      })
    },
    close() {
      this.appToken = null
      this.agent.destroy()
    }
  }
}
