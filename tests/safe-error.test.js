import test from 'node:test'
import assert from 'node:assert/strict'
import { publicPluginError, sanitizeError } from '../lib/safe-error.js'

test('sanitizeError redacts credentials from query strings, assignments and bearer headers', () => {
  const result = sanitizeError('request failed https://service.test/?api_key=abc123secret&token=tokensecret Authorization: Bearer secret-token-value')
  assert.doesNotMatch(result, /abc123secret|tokensecret|secret-token-value/)
  assert.match(result, /api_key=\[REDACTED\]/)
  assert.match(result, /\[REDACTED\]/)
})

test('sanitizeError redacts common API key shapes and absolute file paths', () => {
  const result = sanitizeError('failed with sk-abcdefghijklmnopqrst at /home/ubuntu/private/config.js')
  assert.doesNotMatch(result, /sk-abcdefghijklmnopqrst|\/home\/ubuntu/)
  assert.match(result, /\[REDACTED\]/)
  assert.match(result, /\[PATH\]/)
})

test('publicPluginError keeps deliberate string replies while sanitizing credentials', () => {
  assert.equal(publicPluginError('مفتاح api_key=hidden-value غير صحيح'), 'مفتاح api_key=[REDACTED] غير صحيح')
})

test('publicPluginError never sends Error diagnostics to WhatsApp users', () => {
  assert.equal(publicPluginError(new Error('/srv/private/app.js: token=secret-value')), 'تعذّر تنفيذ الأمر حالياً. حاول مرة أخرى لاحقاً.')
})
