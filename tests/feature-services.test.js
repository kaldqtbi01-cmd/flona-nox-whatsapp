import test from 'node:test'
import assert from 'node:assert/strict'
import { parseModerationDuration, isTemporarilyMuted } from '../lib/group-moderation.js'
import { cancelReminder, createReminder, parseReminderDelay, takeDueReminders } from '../lib/reminders.js'
import { awardGamePoint, getGameLeaderboard } from '../lib/game-leaderboard.js'
import { searchMenuCommands } from '../plugins/command-search.js'
import welcomeSettings from '../plugins/group-welcome-settings.js'
import protectionSettings from '../plugins/group-protection-settings.js'
import tempMute from '../plugins/group-temp-mute.js'

test('parses bounded English and Arabic reminder durations', () => {
  assert.equal(parseReminderDelay('30m'), 30 * 60_000)
  assert.equal(parseReminderDelay('٢ ساعة'), 2 * 60 * 60_000)
  assert.equal(parseReminderDelay('3 أيام'), 3 * 24 * 60 * 60_000)
  assert.equal(parseReminderDelay('31d'), null)
  assert.equal(parseReminderDelay('0m'), null)
  assert.equal(parseReminderDelay('later'), null)
})

test('persists reminders, lists due items and supports per-sender cancellation', () => {
  const db = { data: { reminders: [] } }
  const first = createReminder(db, { chat: 'group@g.us', sender: 'a@s.whatsapp.net', text: 'meeting', delayMs: 60_000, now: 1000, id: 'r1' })
  const second = createReminder(db, { chat: 'group@g.us', sender: 'b@s.whatsapp.net', text: 'call', delayMs: 120_000, now: 1000, id: 'r2' })
  assert.equal(first.dueAt, 61_000)
  assert.equal(cancelReminder(db, { chat: 'group@g.us', sender: 'a@s.whatsapp.net', id: 'r1' }), true)
  assert.equal(cancelReminder(db, { chat: 'group@g.us', sender: 'a@s.whatsapp.net', id: 'r2' }), false)
  assert.deepEqual(takeDueReminders(db, 121_000).map(item => item.id), ['r2'])
  assert.deepEqual(db.data.reminders, [])
})

test('parses temporary mute durations and expires a user mute lazily', () => {
  assert.equal(parseModerationDuration('10m'), 600_000)
  assert.equal(parseModerationDuration('٢ ساعة'), 7_200_000)
  assert.equal(parseModerationDuration('bad'), null)
  const chat = { mutedUsers: { '123@s.whatsapp.net': 5000 } }
  assert.equal(isTemporarilyMuted(chat, '123@s.whatsapp.net', 4999), true)
  assert.equal(isTemporarilyMuted(chat, '123@s.whatsapp.net', 5000), false)
  assert.equal('123@s.whatsapp.net' in chat.mutedUsers, false)
})

test('awards group-scoped game points and sorts the leaderboard', () => {
  const db = { data: { chats: {} } }
  awardGamePoint(db, 'g1@g.us', 'u1@s.whatsapp.net')
  awardGamePoint(db, 'g1@g.us', 'u1@s.whatsapp.net', 2)
  awardGamePoint(db, 'g1@g.us', 'u2@s.whatsapp.net')
  awardGamePoint(db, 'g2@g.us', 'u3@s.whatsapp.net', 5)
  assert.deepEqual(getGameLeaderboard(db, 'g1@g.us'), [
    { jid: 'u1@s.whatsapp.net', points: 3, wins: 2 },
    { jid: 'u2@s.whatsapp.net', points: 1, wins: 1 },
  ])
})

test('searches available menu command labels and sections case-insensitively', () => {
  const plugins = {
    'download.js': { help: ['تحميل <رابط>'], tags: ['download'] },
    'search.js': { help: ['بحث_الأوامر <كلمة>'], tags: ['tools'] },
  }
  const results = searchMenuCommands(plugins, 'تحميل')
  assert.equal(results.length, 1)
  assert.equal(results[0].label, 'تحميل <رابط>')
  assert.equal(results[0].section, 'التنزيل والإنترنت')
  assert.deepEqual(searchMenuCommands(plugins, 'لا يوجد'), [])
})

test('group settings commands save greeting templates and scoped protection switches', async () => {
  const replies = []
  const m = { isGroup: true, reply: async value => replies.push(value) }
  const chat = {}
  await welcomeSettings(m, { chat, text: 'ترحيب أهلًا @user في {group}', usedPrefix: '.' })
  assert.equal(chat.sWelcome, 'أهلًا @user في {group}')
  assert.equal(chat.memberGreetingEnabled, true)
  await welcomeSettings(m, { chat, text: 'off', usedPrefix: '.' })
  assert.equal(chat.memberGreetingEnabled, false)
  await protectionSettings(m, { chat, text: 'روابط off', usedPrefix: '.' })
  await protectionSettings(m, { chat, text: 'سبام on', usedPrefix: '.' })
  await protectionSettings(m, { chat, text: 'حد_السبام 12', usedPrefix: '.' })
  assert.equal(chat.antilink, false)
  assert.equal(chat.antiSpam, true)
  assert.equal(chat.antiSpamLimit, 12)
  assert.equal(replies.length, 5)
})

test('temporary-mute command stores an expiry for the mentioned member', async () => {
  const oldOwner = global.owner
  const oldOwnerLid = global.ownerLid
  global.owner = []
  global.ownerLid = []
  const target = '22222@s.whatsapp.net'
  const chat = {}
  const sent = []
  const now = Date.now()
  const m = { isGroup: true, sender: '11111@s.whatsapp.net', mentionedJid: [target], reply: async value => sent.push(value) }
  const conn = { sendMessage: async (...args) => sent.push(args) }
  try {
    await tempMute(m, { conn, chat, text: '10m repeated messages', participants: [{ id: target, admin: null }] })
    assert.ok(chat.mutedUsers[target] >= now + 10 * 60_000 - 1000)
    assert.ok(sent.length > 0)
  } finally {
    global.owner = oldOwner
    global.ownerLid = oldOwnerLid
  }
})
