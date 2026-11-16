import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCategoryMenuText, formatMainMenuText, formatUptime } from '../lib/menu-presentation.js'

test('main menu presents the FLONA identity, greeting, status and navigation in an Arabic layout', () => {
  const text = formatMainMenuText({
    mention: '@12345',
    developer: 'FLONA Team',
    uptime: '2ي • 3س • 4د',
    time: '09:15:00 PM',
    sectionCount: 10
  })

  assert.match(text, /𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓/)
  assert.match(text, /أهلاً بك يا @12345/)
  assert.match(text, /FLONA Team/)
  assert.match(text, /2ي • 3س • 4د/)
  assert.match(text, /09:15:00 PM/)
  assert.match(text, /\*أقسام فلونا:\* 10/)
  assert.match(text, /اختر وجهتك من الأزرار بالأسفل/)
  assert.match(text, /\*أهلاً بك يا @12345\*/)
})

test('category menu formats each command with the active prefix and exact command count', () => {
  const text = formatCategoryMenuText({
    section: { title: 'الألعاب والترفيه', icon: '🎮' },
    commands: ['تحدي', 'كرة8 <سؤال>'],
    usedPrefix: '!'
  })

  assert.match(text, /🎮 𝐅𝐋𝐎𝐍𝐀/)
  assert.match(text, /الألعاب والترفيه/)
  assert.match(text, /\*عدد الأوامر:\* 2/)
  assert.match(text, /🟢  \*!تحدي\*/)
  assert.match(text, /🟢  \*!كرة8 <سؤال>\*/)
})

test('empty category still receives the branded layout and an accurate zero count', () => {
  const text = formatCategoryMenuText({
    section: { title: 'قسم فارغ', icon: '✨' },
    commands: []
  })

  assert.match(text, /قسم فارغ/)
  assert.match(text, /\*عدد الأوامر:\* 0/)
  assert.match(text, /لا توجد أوامر في هذا القسم حالياً/)
})

test('uptime uses a concise Arabic day/hour/minute format and handles short runtimes', () => {
  assert.equal(formatUptime(183845), '2ي • 3س • 4د')
  assert.equal(formatUptime(0), '0ث')
  assert.equal(formatUptime(65), '1د')
  assert.equal(formatUptime(-20), '0ث')
})
