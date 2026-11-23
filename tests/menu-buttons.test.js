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

test('section body shows commands while the same commands remain available as buttons', () => {
  const commands = ['طقس <اسم المدينة>', 'معلومات المجموعة']
  const text = formatCategoryMenuText({
    section: { title: 'الأدوات', icon: '✨' },
    commands,
    usedPrefix: '.',
    commandCount: commands.length
  })
  const rows = getMenuCommandButtonRows(commands, '.')
  assert.match(text, /عدد الأوامر:\* 2/)
  assert.match(text, /\.طقس <اسم المدينة>/)
  assert.match(text, /\.معلومات المجموعة/)
  assert.deepEqual(rows.map(row => row.id), ['.طقس', '.معلومات'])
})

test('empty sections state that no command buttons are available', () => {
  const text = formatCategoryMenuText({
    section: { title: 'قسم فارغ', icon: '✨' },
    commandCount: 0
  })
  assert.match(text, /لا توجد أوامر في هذا القسم حالياً/)
})
