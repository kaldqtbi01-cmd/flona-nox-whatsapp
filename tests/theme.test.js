import test from 'node:test'
import assert from 'node:assert/strict'
import { theme } from '../lib/theme.js'

test('builds readable Arabic text for known card parts', () => {
  const output = theme.build([
    { type: 'title', text: 'بحث' },
    { type: 'divider' },
    { type: 'info', label: 'الاستخدام', value: '!بحث كلمة' },
    { type: 'line', text: 'جرّب مرة أخرى' },
  ])
  assert.match(output, /بحث/)
  assert.match(output, /الاستخدام: !بحث كلمة/)
  assert.match(output, /جرّب مرة أخرى/)
})
