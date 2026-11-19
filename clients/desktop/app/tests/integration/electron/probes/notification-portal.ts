/** @fileoverview Verifies an OS-owned action payload on a private D-Bus session across two Electron processes. */

import assert from 'node:assert/strict'
import { sessionBus, toPlain, Variant } from 'dbus-native'
import type { NativeViewTarget } from '@kisaki3/desktop-contracts/ui'
import { createNotifications } from '../../../../src/main/infrastructure/notifications'
import { createActivation } from '../../../../src/main/app/activation'

/** Isolated desktop identity advertised by the test's D-Bus service file. */
const appId = 'me.kisaki.dev'

/** The test controls the portal so its submitted action can be retained after the original sender exits. */
const portal = {
  destination: 'org.freedesktop.portal.Desktop',
  path: '/org/freedesktop/portal/desktop',
}

/** Unexpected desktop launches would turn a targeted activation into an extra navigation. */
function unexpected() {
  assert.fail('Unexpected desktop activation')
}

/** Captures the production AddNotification payload and delivers its action to the newly activated service. */
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
        /** Accepts the unsandboxed application's explicit portal identity. */
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
        /** Records what the actual production serializer hands to the notification server. */
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
        /** Acknowledges the single navigation delivered by the fresh process. */
        Received(pid: number, json: string) {
          restored.resolve({ pid, target: JSON.parse(json) as NativeViewTarget })
        },
      },
      portal.path,
      { name: 'me.kisaki.test.Receipt', methods: { Received: ['us', '', ['pid', 'target'], []] } },
    )
    await bus.requestName(portal.destination, 4)

    await sender.ready(true)
    assert.equal(
      await sender.show({ title: 'Sample task', body: 'Completed', open: target }),
      'accepted',
    )
    const token = await submitted.promise
    await sender.close()
    assert.ok(!(await bus.listNames()).includes(appId))

    await bus.invoke({
      destination: appId,
      path: '/me/kisaki/dev',
      interface: 'org.freedesktop.Application',
      member: 'ActivateAction',
      signature: 'sava{sv}',
      body: ['open-notification', [new Variant('s', token)], []],
    })
    const receipt = await restored.promise
    assert.notEqual(receipt.pid, process.pid)
    assert.deepEqual(receipt.target, target)
  } finally {
    await sender.close()
    await bus.close()
  }
}

/** Receives an OS activation before window readiness and delivers it once when navigation becomes available. */
export async function receivePortalAction() {
  const received = Promise.withResolvers<void>()
  const activation = createActivation(received.reject)
  const bus = sessionBus()
  const service = createNotifications(appId, {
    activate: unexpected,
    openUrl: unexpected,
    /** Accepts the target while startup is still waiting for the document. */
    notification(value) {
      activation.notification(appId, value)
      received.resolve()
    },
  })
  try {
    await service.ready(true)
    await received.promise
    let deliveries = 0
    await activation.ready(async (request) => {
      assert.equal(request.type, 'native')
      deliveries++
      await bus.invoke({
        ...portal,
        interface: 'me.kisaki.test.Receipt',
        member: 'Received',
        signature: 'us',
        body: [process.pid, JSON.stringify(request.target)],
      })
    })
    assert.equal(deliveries, 1)
  } finally {
    await service.close()
    await bus.close()
  }
}
