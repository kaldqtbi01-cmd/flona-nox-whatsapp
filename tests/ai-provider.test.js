import test from 'node:test'
import assert from 'node:assert/strict'
import { createAIProviders } from '../lib/ai-providers.js'

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) }
}

test('يعرض حالة المزودين دون كشف قيم المفاتيح', () => {
  const api = createAIProviders({ env: { GROQ_API_KEY: 'secret-groq', GEMINI_API_KEY: '' }, fetchImpl: async () => response({}) })
  assert.deepEqual(api.status().groq.configured, true)
  assert.deepEqual(api.status().gemini.configured, false)
  assert.doesNotMatch(JSON.stringify(api.status()), /secret-groq/)
})

test('يوجه النص إلى Groq', async () => {
  const calls = []
  const api = createAIProviders({
    env: { GROQ_API_KEY: 'groq-secret', GEMINI_API_KEY: 'gemini-secret' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return response({ choices: [{ message: { content: 'رد Groq' } }] })
    },
  })
  const result = await api.ask({ task: 'chat', input: 'اكتب ردًا' })
  assert.equal(result.provider, 'groq')
  assert.equal(result.text, 'رد Groq')
  assert.match(calls[0].url, /api\.groq\.com/)
})

test('يوجه الصورة إلى Gemini', async () => {
  const calls = []
  const api = createAIProviders({
    env: { GROQ_API_KEY: 'groq-secret', GEMINI_API_KEY: 'gemini-secret' },
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return response({ candidates: [{ content: { parts: [{ text: 'تحليل الصورة' }] } }] })
    },
  })
  const result = await api.ask({ task: 'vision', input: [{ type: 'text', text: 'ما هذه؟' }, { type: 'image', mimeType: 'image/jpeg', data: 'abc' }] })
  assert.equal(result.provider, 'gemini')
  assert.equal(result.text, 'تحليل الصورة')
  assert.match(calls[0].url, /generativelanguage\.googleapis\.com/)
})

test('يستخدم fallback عند فشل Groq', async () => {
  const calls = []
  const api = createAIProviders({
    env: { GROQ_API_KEY: 'groq-secret', GEMINI_API_KEY: 'gemini-secret' },
    fetchImpl: async (url) => {
      calls.push(url)
      if (url.includes('groq')) return response({ error: { message: 'temporary' } }, 503)
      return response({ candidates: [{ content: { parts: [{ text: 'fallback Gemini' }] } }] })
    },
  })
  const result = await api.ask({ task: 'chat', input: 'اختبار fallback' })
  assert.equal(result.provider, 'gemini')
  assert.equal(calls.length, 3) // Groq + retry واحد ثم Gemini fallback
})

test('ينقح أخطاء المزود ولا يعيد المفتاح', async () => {
  const secret = 'groq-secret-value'
  const api = createAIProviders({
    env: { GROQ_API_KEY: secret, GEMINI_API_KEY: '' },
    fetchImpl: async () => response({ error: { message: secret } }, 400),
  })
  await assert.rejects(api.ask({ task: 'chat', input: 'x', fallback: false }), error => {
    assert.doesNotMatch(error.message, new RegExp(secret))
    return true
  })
})
