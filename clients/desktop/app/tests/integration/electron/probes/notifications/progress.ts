import { appendFileSync } from 'node:fs'

export function record(stage: string) {
  appendFileSync(
    process.env.KISAKI_NOTIFICATION_LOG!,
    `${new Date().toISOString()} pid=${process.pid} ${stage}\n`,
  )
}
