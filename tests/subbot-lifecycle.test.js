import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getSocketSubBotNumber,
  getSubBotReconnectDelay,
  hasActiveSubBot,
  hasOpenSubBot,
  isSubBotSocketActive,
  isSubBotSocketOpen,
  subBotNumber,
} from '../lib/subbot-lifecycle.js'

test('normalizes a session number and extracts it from socket identities', () => {
  assert.equal(subBotNumber('967700000001:12@s.whatsapp.net'), '967700000001')
  assert.equal(getSocketSubBotNumber({ user: { jid: '967700000001:12@s.whatsapp.net' } }), '967700000001')
})

test('a closed WebSocket is not alive just because socket.user.jid exists', () => {
  const socket = {
    user: { jid: '967700000001@s.whatsapp.net' },
    ws: { isOpen: false, isConnecting: false },
  }

  assert.equal(isSubBotSocketOpen(socket, '967700000001'), false)
  assert.equal(hasOpenSubBot([socket], '967700000001'), false)
  assert.equal(isSubBotSocketActive(socket, '967700000001'), false)
  assert.equal(hasActiveSubBot([socket], '967700000001'), false)
})

test('a matching socket that is connecting prevents duplicate startup but is not yet open', () => {
  const socket = {
    authState: { creds: { me: { id: '967700000001@s.whatsapp.net' } } },
    ws: { isOpen: false, isConnecting: true },
  }

  assert.equal(isSubBotSocketOpen(socket, '967700000001'), false)
  assert.equal(hasOpenSubBot([socket], '967700000001'), false)
  assert.equal(isSubBotSocketActive(socket, '967700000001'), true)
  assert.equal(hasActiveSubBot([socket], '967700000001'), true)
  assert.equal(hasActiveSubBot([socket], '967700000002'), false)
})

test('reconnect delay grows exponentially, adds bounded jitter, and caps at five minutes', () => {
  assert.equal(getSubBotReconnectDelay(0, 0), 1_000)
  assert.equal(getSubBotReconnectDelay(1, 0.5), 2_500)
  assert.equal(getSubBotReconnectDelay(2, 0), 4_000)
  assert.equal(getSubBotReconnectDelay(50, 0.999), 5 * 60_000)
  assert.equal(getSubBotReconnectDelay(-10, 0), 1_000)
})
