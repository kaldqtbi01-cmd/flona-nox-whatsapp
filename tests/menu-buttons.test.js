import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCategoryMenuText, getMenuCommandButtonRows } from '../lib/menu-presentation.js'

test('all category commands appear in one clickable list with descriptions for commands that need them', () => {
  const commands = Array.from({ length: 17 }, (_, index) => `أمر${index + 1} <النص المطلوب>`)
  const rows = getMenuCommandButtonRows(commands, '.')

  assert.equal(rows.length, 17)
  assert.equal(rows[0].title, '.أمر1')
  assert.equal(rows[0].id, '.أمر1')
  assert.equal(rows[0].description, 'النص المطلوب')
  assert.equal(rows.at(-1).id, '.أمر17')
  assert.ok(rows.every(row => !row.id.includes('menu ')))
})

test('section body contains instructions but does not list commands as text', () => {
  const text = formatCategoryMenuText({
    section: { title: 'الأدوات', icon: '✨' },
    commandCount: 17
  })
  assert.match(text, /عدد الأوامر:\* 17/)
  assert.match(text, /اختر الأمر من زر/)
  assert.doesNotMatch(text, /\.أمر1/)
})

test('empty sections state that no command buttons are available', () => {
  const text = formatCategoryMenuText({
    section: { title: 'قسم فارغ', icon: '✨' },
    commandCount: 0
  })
  assert.match(text, /لا توجد أوامر في هذا القسم حالياً/)
})
