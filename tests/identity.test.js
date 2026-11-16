import test from 'node:test'
import assert from 'node:assert/strict'
import { asText, extractJidFromParam, isMentionableJid, normalizeJid, rememberParticipants, getKnownJidVariants } from '../lib/identity.js'

test('normalizes phone JIDs and device suffixes', () => {
  assert.equal(normalizeJid('967700000001:12@s.whatsapp.net'), '967700000001@s.whatsapp.net')
  assert.equal(normalizeJid('967700000001'), '967700000001@s.whatsapp.net')
  assert.equal(normalizeJid('not-a-jid'), null)
})

test('extracts only valid WhatsApp identities from parameters', () => {
  assert.equal(extractJidFromParam({ participant: '123456789012@lid' }), '123456789012@lid')
  assert.equal(extractJidFromParam('invite unknown'), null)
  assert.equal(isMentionableJid('123456789012@g.us'), false)
  assert.equal(isMentionableJid('123456789012@lid'), true)
})

test('remembers participant identifier variants with bounded API', () => {
  rememberParticipants([{ id: '123456789012@s.whatsapp.net', lid: '555555555555@lid' }])
  assert.deepEqual(getKnownJidVariants('123456789012@s.whatsapp.net'), ['123456789012@s.whatsapp.net', '555555555555@lid'])
})

test('converts supported metadata values to display text', () => {
  assert.equal(asText({ subject: 'مجموعة FLONA' }), 'مجموعة FLONA')
  assert.equal(asText(null), '')
})
