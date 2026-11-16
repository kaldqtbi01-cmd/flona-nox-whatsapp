import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSyncedLyrics, plainLyricsToSynced } from '../lib/lrclib.js'

test('parses fractional timestamps and ignores empty lines', () => {
  assert.deepEqual(parseSyncedLyrics('[00:01.50]مرحبا\n[00:03:20]كيف الحال\n[00:05.00]'), [
    { time: 1.5, text: 'مرحبا' },
    { time: 3.2, text: 'كيف الحال' },
  ])
})

test('converts plain lyrics without claiming exact synchronization', () => {
  assert.deepEqual(plainLyricsToSynced('سطر أول\n\nسطر ثان'), [
    { time: 0, text: 'سطر أول' },
    { time: 4, text: 'سطر ثان' },
  ])
})
