/** @fileoverview Verifies complete defaults, independent preference edits, and proxy credential comparison. */

import { describe, expect, it } from 'vitest'
import {
  createDefaultPreferences,
  parseAccelerator,
  parsePreferenceUpdate,
  parsePreferences,
  parseReadingPreferences,
} from './preferences'

const context = { platform: 'windows', nativePages: [] } as const

describe('preferences', () => {
  it('provides complete independent defaults and actual platform fullscreen bindings', () => {
    const defaults = createDefaultPreferences(context)
    expect(parsePreferences(defaults)).toEqual(defaults)
    expect(defaults.usage.comic).not.toBe(defaults.usage.novel)
    expect(defaults.shortcuts['reader.fullscreen'].accelerators).toEqual(['F11'])
    expect(
      createDefaultPreferences({ ...context, platform: 'macos' }).shortcuts['reader.fullscreen']
        .accelerators,
    ).toEqual(['Control+Command+F'])
    const { 'game.viewWork': omitted, ...shortcuts } = defaults.shortcuts
    expect(omitted.accelerators).toEqual([])
    expect(() => parsePreferences({ ...defaults, shortcuts })).toThrow()
  })

  it('preserves independent nested changes and rejects unrelated or undefined baselines', () => {
    const input = {
      changes: { usage: { novel: { text: { fontSize: 24 } } } },
      expected: { usage: { novel: { text: { fontSize: 20 } } } },
    }
    expect(parsePreferenceUpdate(input)).toEqual(input)
    expect(() =>
      parsePreferenceUpdate({
        ...input,
        expected: { usage: { novel: { text: { padding: 24 } } } },
      }),
    ).toThrow()
    expect(() =>
      parsePreferenceUpdate({ changes: { usage: { novel: { text: { fontSize: undefined } } } } }),
    ).toThrow()
    expect(() => parsePreferenceUpdate({ changes: { navigation: [] } })).toThrow()
    expect(() =>
      parsePreferenceUpdate({
        changes: { usage: { novel: { text: { font: { type: 'library' } } } } },
      }),
    ).toThrow()
    expect(() =>
      parsePreferenceUpdate({
        changes: { shortcuts: { 'reader.viewWork': { enabled: true } } },
        expected: { shortcuts: { 'reader.viewWork': { accelerators: [] } } },
      }),
    ).toThrow()
  })

  it('requires the original complete credential state for replacement or deletion', () => {
    expect(() => parsePreferenceUpdate({ changes: { network: { credentials: null } } })).toThrow()
    expect(() =>
      parsePreferenceUpdate({
        changes: { network: { credentials: { username: 'user' } } },
        expected: { network: { credentials: null } },
      }),
    ).toThrow()
    expect(
      parsePreferenceUpdate({
        changes: { network: { credentials: { username: 'user', password: 'secret' } } },
        expected: { network: { credentials: { revision: 'old' } } },
      }).expected?.network?.credentials,
    ).toEqual({ revision: 'old' })
    expect(
      parsePreferenceUpdate({
        changes: { network: { credentials: null } },
        expected: { network: { credentials: null } },
      }).changes.network?.credentials,
    ).toBeNull()
  })

  it('rejects unusable manual proxies and embedded credentials without silently changing policy', () => {
    const defaults = createDefaultPreferences(context)
    expect(() =>
      parsePreferences({ ...defaults, network: { ...defaults.network, mode: 'manual' } }),
    ).toThrow()
    for (const endpoint of [
      'http://user:password@proxy:8080',
      'socks5://proxy:1080/path',
      'http://proxy:8080;other:90',
      'http://proxy:8080?url=x',
    ]) {
      expect(() =>
        parsePreferences({ ...defaults, network: { ...defaults.network, endpoint } }),
      ).toThrow()
    }
    expect(
      parsePreferences({
        ...defaults,
        network: { ...defaults.network, mode: 'manual', endpoint: 'http://[::1]:8080' },
      }).network.endpoint,
    ).toBe('http://[::1]:8080')
    expect(() =>
      parsePreferences({
        ...defaults,
        network: {
          ...defaults.network,
          endpoint: 'socks5://proxy:1080',
          credentials: { revision: 'saved' },
        },
      }),
    ).toThrow()
  })

  it('checks inactive reading fields and deduplicates ordered languages and accelerators', () => {
    const defaults = createDefaultPreferences(context)
    expect(() =>
      parseReadingPreferences({
        ...defaults.usage.novel,
        flow: 'continuous',
        text: { ...defaults.usage.novel.text, pagesPerView: 3 },
      }),
    ).toThrow()
    expect(() =>
      parseReadingPreferences({
        ...defaults.usage.novel,
        pages: { ...defaults.usage.novel.pages, brightness: 2.1 },
      }),
    ).toThrow()
    expect(
      parsePreferenceUpdate({
        changes: {
          usage: { anime: { audioLanguages: ['EN-us', 'en-US', 'ja'] } },
          shortcuts: {
            'reader.find': { accelerators: ['Control+Shift+F', 'shift+ctrl+f', 'Alt+F'] },
          },
        },
      }).changes,
    ).toEqual({
      usage: { anime: { audioLanguages: ['en-US', 'ja'] } },
      shortcuts: { 'reader.find': { accelerators: ['Control+Shift+F', 'Alt+F'] } },
    })
  })

  it('uses documented accelerator keys without accepting missing keys or arbitrary names', () => {
    for (const value of ['CommandOrControl+S', 'Ctrl++', 'Shift+F24', 'Alt+num9', 'Space']) {
      expect(parseAccelerator(value)).toBe(value)
    }
    for (const value of ['Ctrl+', 'Hyper+J', 'F25', 'Ctrl+Unknown', ' Ctrl+A']) {
      expect(() => parseAccelerator(value)).toThrow()
    }
  })
})
