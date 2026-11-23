import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../plugins/المتصلين.js'

test('lists unique senders from cached group messages and excludes the bot', async () => {
  const group = '120363000-123456@g.us'
  const sent = []
  const replies = []
  const m = {
    chat: group,
    key: { id: 'command-1' },
    reply: async text => replies.push(text)
  }
  const conn = {
    chats: {
      [group]: {
        messages: {
          one: { key: { participant: '222@s.whatsapp.net' } },
          two: { key: { participant: '111@s.whatsapp.net' } },
          duplicate: { key: { participant: '222@s.whatsapp.net' } },
          fromBot: { key: { participant: '999@s.whatsapp.net', fromMe: true } },
          noParticipant: { key: {} }
        }
      }
    },
    sendMessage: async (...args) => sent.push(args)
  }

  await handler(m, { conn, args: [] })
  const report = sent.find(([, payload]) => payload?.text)
  assert.deepEqual(report[1].mentions, ['111@s.whatsapp.net', '222@s.whatsapp.net'])
  assert.match(report[1].text, /@111/)
  assert.match(report[1].text, /@222/)
  assert.deepEqual(replies, [])
})

test('rejects a request to read another group history', async () => {
  const replies = []
  const m = {
    chat: '120363000-123456@g.us',
    reply: async text => replies.push(text)
  }
  const conn = { sendMessage: async () => assert.fail('must not send for another group') }

  await handler(m, { conn, args: ['120363000-987654@g.us'] })
  assert.match(replies[0], /استخدم الأمر داخل المجموعة المطلوبة/)
})
