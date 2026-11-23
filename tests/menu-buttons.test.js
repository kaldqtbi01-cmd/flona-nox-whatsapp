import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCategoryMenuText, getMenuCommandButtonRows } from '../lib/menu-presentation.js'

test('category command buttons execute commands and paginate within WhatsApp list limits', () => {
  const commands = Array.from({ length: 17 }, (_, index) => `أمر${index + 1} <نص>`)

  const firstPage = getMenuCommandButtonRows(commands, 0, 3, 'tools', '.')
  assert.equal(firstPage.length, 9)
  assert.equal(firstPage[0].title, '.أمر1')
  assert.equal(firstPage[0].id, '.أمر1')
  assert.equal(firstPage.at(-1).id, '.menu tools 1')

  const middlePage = getMenuCommandButtonRows(commands, 1, 3, 'tools', '.')
  assert.equal(middlePage.length, 10)
  assert.equal(middlePage[0].id, '.أمر9')
  assert.equal(middlePage.at(-2).id, '.menu tools 0')
  assert.equal(middlePage.at(-1).id, '.menu tools 2')

  const finalPage = getMenuCommandButtonRows(commands, 2, 3, 'tools', '.')
  assert.equal(finalPage.length, 2)
  assert.equal(finalPage[0].id, '.أمر17')
  assert.equal(finalPage[1].id, '.menu tools 1')
})

test('section menu text reports total commands and the current page', () => {
  const text = formatCategoryMenuText({
    section: { title: 'الأدوات', icon: '✨' },
    commands: ['طقس <مدينة>'],
    commandCount: 17,
    pageNumber: 2,
    pageCount: 3
  })
  assert.match(text, /عدد الأوامر:\* 17 • الصفحة 2\/3/)
  assert.match(text, /\.طقس <مدينة>/)
})
