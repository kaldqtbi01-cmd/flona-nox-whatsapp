import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../plugins/group-xo.js'

function setup(name) {
  const chat = `${name}@g.us`
  const x = `${name}-x@s.whatsapp.net`
  const o = `${name}-o@s.whatsapp.net`
  const outsider = `${name}-outsider@s.whatsapp.net`
  const sent = []
  const replies = []
  const conn = {
    user: { jid: 'bot@s.whatsapp.net' },
    decodeJid: jid => jid,
    sendMessage: async (_chat, payload, options) => {
      sent.push({ payload, options })
      return { key: { id: `out-${sent.length}` } }
    },
  }
  const groupMetadata = { participants: [{ id: x }, { id: o }, { id: 'bot@s.whatsapp.net' }] }
  const message = (sender, text, mentionedJid = []) => ({
    chat, sender, text, mentionedJid,
    reply: async value => replies.push(value),
  })
  const call = (m, text) => handler(m, { conn, text, groupMetadata })
  return { chat, x, o, outsider, sent, replies, message, call }
}

test('starts a group game only when both mentioned players belong to the group', async () => {
  const game = setup('xo-start')
  await game.call(game.message(game.x, '', [game.o]), '')
  assert.equal(game.sent.length, 1)
  assert.match(game.sent[0].payload.text, /بدأت لعبة إكس-أو/)
  assert.match(game.sent[0].payload.text, /يبدأ X/)
  assert.deepEqual(new Set(game.sent[0].payload.mentions), new Set([game.x, game.o]))

  const outside = setup('xo-outside')
  await outside.call(outside.message(outside.x, '', [outside.outsider]), '')
  assert.equal(outside.sent.length, 0)
  assert.match(outside.replies[0], /عضوين في هذه المجموعة/)
})

test('enforces turns and occupied cells, then declares a winner and clears the round', async () => {
  const game = setup('xo-win')
  await game.call(game.message(game.x, '', [game.o]), '')

  await game.call(game.message(game.o, '1'), '1')
  assert.match(game.replies.at(-1), /انتظر دورك/)

  await game.call(game.message(game.x, '1'), '1')
  await game.call(game.message(game.o, '4'), '4')
  await game.call(game.message(game.x, '1'), '1')
  assert.match(game.replies.at(-1), /الخانة مشغولة/)
  await game.call(game.message(game.x, '2'), '2')
  await game.call(game.message(game.o, '5'), '5')
  await game.call(game.message(game.x, '3'), '3')

  assert.match(game.sent.at(-1).payload.text, /فاز @xo-win-x/)
  assert.match(game.sent.at(-1).payload.text, /❌/)
  await game.call(game.message(game.x, '', [game.o]), '')
  assert.match(game.sent.at(-1).payload.text, /بدأت لعبة إكس-أو/)
})

test('allows either player to surrender and rejects use outside groups through metadata', async () => {
  const game = setup('xo-surrender')
  await game.call(game.message(game.x, '', [game.o]), '')
  await game.call(game.message(game.o, 'انسحاب'), 'انسحاب')
  assert.match(game.sent.at(-1).payload.text, /انتهت اللعبة بالانسحاب/)
  await game.call(game.message(game.x, '', [game.outsider]), '')
  assert.match(game.replies.at(-1), /عضوين في هذه المجموعة/)
  assert.equal(handler.group, true)
})
