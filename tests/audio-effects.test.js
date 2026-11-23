import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../plugins/audio-effects.js'

function mockMessage(quoted) {
  const replies = []
  return {
    m: {
      chat: 'audio-test@s.whatsapp.net',
      quoted,
      reply: async text => replies.push(text),
    },
    replies,
  }
}

test('audio command requests one of the fixed effects instead of accepting arbitrary filters', async () => {
  const { m, replies } = mockMessage(null)
  await handler(m, { conn: {}, text: 'arbitrary-filter' })
  assert.match(replies[0], /سريع، بطيء، عميق، صدى، أو عكس/)
})

test('audio command requires a quoted voice message', async () => {
  const { m, replies } = mockMessage(null)
  await handler(m, { conn: {}, text: 'صدى' })
  assert.match(replies[0], /رد على رسالة صوتية/)
})
