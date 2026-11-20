import test from 'node:test'
import assert from 'node:assert/strict'
import tagAllHandler from '../plugins/تاق_الكل.js'

const owner = '967700000001@s.whatsapp.net'
const groupOne = '111111111-222222222@g.us'
const groupTwo = '333333333-444444444@g.us'

function metadata(subject, numbers) {
  return { subject, participants: numbers.map(number => ({ id: `${number}@s.whatsapp.net` })) }
}

function mockConnection(groups) {
  const sent = []
  return {
    sent,
    groupFetchAllParticipating: async () => groups,
    groupMetadata: async id => groups[id],
    sendMessage: async (chat, payload, options) => { sent.push({ chat, payload, options }) },
  }
}

function privateMessage(chat = owner) {
  return { isGroup: false, chat, sender: chat, key: { id: `dm-${Math.random()}` } }
}

test('منشن من الخاص يعرض المجموعات ولا يرسل قبل اختيارها', async () => {
  const conn = mockConnection({
    [groupOne]: metadata('مجموعة العائلة', ['967700000002', '967700000003']),
    [groupTwo]: metadata('مجموعة الأصدقاء', ['967700000004']),
  })

  await tagAllHandler(privateMessage(), { conn, command: 'منشن', args: ['جمعة', 'مباركة'], isROwner: true })

  assert.equal(conn.sent.length, 1)
  assert.equal(conn.sent[0].chat, owner)
  assert.match(conn.sent[0].payload.text, /مجموعة العائلة/)
  assert.match(conn.sent[0].payload.text, /مجموعة الأصدقاء/)
  assert.match(conn.sent[0].payload.text, /اختيار_منشن \d+/)
  assert.equal(conn.sent.some(item => item.chat.endsWith('@g.us')), false)
})

test('اختيار المجموعة يعرض معاينة ولا يرسل إلا بعد تأكيد المطوّر', async () => {
  const groups = { [groupOne]: metadata('مجموعة الجمعة', ['967700000002', '967700000003']) }
  const conn = mockConnection(groups)

  await tagAllHandler(privateMessage(), { conn, command: 'منشن', args: ['جمعة', 'مباركة'], isROwner: true })
  await tagAllHandler(privateMessage(), { conn, command: 'اختيار_منشن', args: ['1'], isROwner: true })

  assert.equal(conn.sent.filter(item => item.chat === groupOne).length, 0)
  assert.match(conn.sent.at(-1).payload.text, /جمعة مباركة/)
  assert.match(conn.sent.at(-1).payload.text, /تأكيد_منشن/)

  await tagAllHandler(privateMessage(), { conn, command: 'تأكيد_منشن', args: [], isROwner: true })

  const broadcast = conn.sent.find(item => item.chat === groupOne)
  assert.ok(broadcast)
  assert.match(broadcast.payload.text, /جمعة مباركة/)
  assert.deepEqual(broadcast.payload.mentions, ['967700000002@s.whatsapp.net', '967700000003@s.whatsapp.net'])
  assert.deepEqual(broadcast.payload.contextInfo.mentionedJid, broadcast.payload.mentions)
  assert.match(conn.sent.at(-1).payload.text, /تم إرسال المنشن/)
})

test('منع غير المطوّر من استخدام المنشن من الخاص', async () => {
  const conn = mockConnection({ [groupOne]: metadata('مجموعة', ['967700000002']) })

  await tagAllHandler(privateMessage('967700000009@s.whatsapp.net'), {
    conn,
    command: 'منشن',
    args: ['رسالة'],
    isROwner: false,
  })

  assert.equal(conn.sent.length, 1)
  assert.match(conn.sent[0].payload.text, /للمطوّر الرئيسي فقط/)
  assert.equal(conn.sent[0].chat, '967700000009@s.whatsapp.net')
})

test('المنشن المخصص داخل المجموعة يستمر بالعمل', async () => {
  const conn = mockConnection({})
  const groupMessage = {
    isGroup: true,
    chat: groupOne,
    sender: owner,
    key: { id: 'group-message' },
    reply: async text => conn.sent.push({ chat: groupOne, payload: { text } }),
  }

  await tagAllHandler(groupMessage, {
    conn,
    command: 'منشن',
    args: ['عيدكم', 'مبارك'],
    participants: [{ id: '967700000002@s.whatsapp.net' }],
    groupMetadata: { subject: 'مجموعة العائلة' },
    isROwner: true,
  })

  const broadcast = conn.sent.find(item => item.chat === groupOne && item.payload.caption)
  assert.ok(broadcast)
  assert.match(broadcast.payload.caption, /عيدكم مبارك/)
  assert.deepEqual(broadcast.payload.mentions, ['967700000002@s.whatsapp.net'])
})
