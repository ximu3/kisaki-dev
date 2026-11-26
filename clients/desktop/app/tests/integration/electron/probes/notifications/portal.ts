import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { sessionBus, toPlain, Variant } from 'dbus-native'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import { createNotifications } from '../../../../../src/main/infrastructure/notifications'
import { record } from './progress'
import { createActivation, type ActivationRequest } from '../../../../../src/main/app/activation'

const appId = 'me.kisaki.dev'

const portal = {
  destination: 'org.freedesktop.portal.Desktop',
  path: '/org/freedesktop/portal/desktop',
}

function unexpected() {
  assert.fail('Unexpected desktop activation')
}

export async function verifyPortalHandoff(target: NativeViewTarget) {
  const bus = sessionBus()
  const submitted = Promise.withResolvers<string>()
  const restored = Promise.withResolvers<{ pid: number; target: NativeViewTarget }>()
  const sender = createNotifications(appId, {
    activate: unexpected,
    openUrl: unexpected,
    notification: unexpected,
  })
  try {
    bus.exportInterface(
      {
        Register(id: string) {
          assert.equal(id, appId)
        },
      },
      portal.path,
      {
        name: 'org.freedesktop.host.portal.Registry',
        methods: { Register: ['sa{sv}', '', ['app_id', 'options'], []] },
      },
    )
    bus.exportInterface(
      {
        AddNotification(id: string, input: unknown) {
          const fields = toPlain<Record<string, unknown>>(input)
          assert.equal(fields['default-action'], 'app.open-notification')
          assert.equal(fields['default-action-target'], id)
          submitted.resolve(id)
        },
      },
      portal.path,
      {
        name: 'org.freedesktop.portal.Notification',
        methods: { AddNotification: ['sa{sv}', '', ['id', 'notification'], []] },
      },
    )
    bus.exportInterface(
      {
        Received(pid: number, json: string) {
          restored.resolve({ pid, target: JSON.parse(json) as NativeViewTarget })
        },
      },
      portal.path,
      { name: 'me.kisaki.test.Receipt', methods: { Received: ['us', '', ['pid', 'target'], []] } },
    )
    assert.equal(await bus.requestName(portal.destination, 4), 1)
    record('Portal owns the test bus name')

    await sender.ready(true)
    record('Submitting portal notification')
    assert.equal(
      await sender.show({ title: 'Sample task', body: 'Completed', open: target }),
      'accepted',
    )
    const token = await submitted.promise
    record('Portal retained the notification action')
    await sender.close()
    assert.equal(await bus.nameHasOwner(appId), false)
    record('Sender released its bus name, activating the saved action')

    await bus.invoke({
      destination: appId,
      path: '/me/kisaki/dev',
      interface: 'org.freedesktop.Application',
      member: 'ActivateAction',
      signature: 'sava{sv}',
      body: ['open-notification', [new Variant('s', token)], []],
    })
    record('Activation dispatched, waiting for receiver receipt')
    const receipt = await restored.promise
    assert.notEqual(receipt.pid, process.pid)
    assert.deepEqual(receipt.target, target)
    record(`Receipt verified, waiting for receiver ${receipt.pid} to exit`)
    for (;;) {
      try {
        process.kill(receipt.pid, 0)
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === 'ESRCH') {
          break
        }
        throw cause
      }
      await delay(50)
    }
    record('Restored receiver exited')
  } finally {
    await sender.close()
    await bus.close()
  }
}

export async function receivePortalAction() {
  const received = Promise.withResolvers<void>()
  const activation = createActivation(received.reject)
  const bus = sessionBus()
  const service = createNotifications(appId, {
    activate: unexpected,
    openUrl: unexpected,
    notification(value) {
      activation.notification(appId, value)
      received.resolve()
    },
  })
  try {
    let delivered: NativeViewTarget | undefined
    try {
      await service.ready(true)
      record('Receiver ready, waiting for the saved action')
      await received.promise
      const delivery = Promise.withResolvers<ActivationRequest>()
      let count = 0
      activation.ready(async (request) => {
        count++
        delivery.resolve(request)
      })
      const request = await delivery.promise
      assert.equal(count, 1, 'The action must be delivered once')
      assert.equal(request.type, 'native')
      delivered = request.target
    } finally {
      await service.close()
    }
    record('Receiver delivered the action and released the service')
    await bus.invoke({
      ...portal,
      interface: 'me.kisaki.test.Receipt',
      member: 'Received',
      signature: 'us',
      body: [process.pid, JSON.stringify(delivered)],
    })
  } finally {
    await bus.close()
  }
}
