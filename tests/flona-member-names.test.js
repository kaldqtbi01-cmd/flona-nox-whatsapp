import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSoulPrompt,
  clearSoulMemory,
  getMemberName,
  getSoulSettings,
  listKnownMemberNames,
  rememberMemberName,
} from '../lib/flona-soul-engine.js'

test('member names are stored per group, with the declared alias taking priority', () => {
  const groupA = {}
  const groupB = {}
  const jid = '12345@s.whatsapp.net'

  assert.equal(rememberMemberName(groupA, jid, { whatsappName: 'Noor' }), true)
  assert.equal(getMemberName(groupA, jid), 'Noor')
  assert.equal(rememberMemberName(groupA, jid, { whatsappName: 'Noor', alias: 'سارة' }), true)
  assert.equal(getMemberName(groupA, jid, 'fallback'), 'سارة')

  rememberMemberName(groupA, jid, { whatsappName: 'Noura' })
  assert.equal(getMemberName(groupA, jid), 'سارة')
  assert.deepEqual(listKnownMemberNames(groupA), ['سارة (اسم واتساب: Noura)'])
  assert.equal(getMemberName(groupB, jid), '')
})

test('known names are available to the AI prompt without exposing JIDs', () => {
  const group = {}
  rememberMemberName(group, '12345@s.whatsapp.net', { whatsappName: 'Noor', alias: 'سارة' })
  const prompt = buildSoulPrompt({
    senderName: 'سارة', text: 'مين هذه؟', quotedText: '', recentContext: '',
    personality: 'wise', dialect: 'auto', mood: 'calm',
    knownMembers: listKnownMemberNames(group),
  })
  assert.match(prompt, /سارة \(اسم واتساب: Noor\)/)
  assert.doesNotMatch(prompt, /12345@s\.whatsapp\.net/)
})

test('clearing Luka memory also clears saved names and short context', () => {
  const group = { soulAI: { context: [{ sender: 'Noor', text: 'hi', reply: 'hello' }] } }
  rememberMemberName(group, '12345@s.whatsapp.net', { whatsappName: 'Noor', alias: 'سارة' })
  clearSoulMemory(group)
  assert.deepEqual(listKnownMemberNames(group), [])
  assert.deepEqual(getSoulSettings(group).context, [])
})

test('memory-disabled groups do not store new names', () => {
  const group = { soulAI: { memoryEnabled: false } }
  assert.equal(rememberMemberName(group, '12345@s.whatsapp.net', { whatsappName: 'Noor' }), false)
  assert.equal(getMemberName(group, '12345@s.whatsapp.net', 'Noor'), 'Noor')
  assert.deepEqual(listKnownMemberNames(group), [])
})
