const DEFAULTS = Object.freeze({
  groqModel: 'openai/gpt-oss-120b',
  geminiModel: 'gemini-3.1-flash-lite',
  timeoutMs: 30_000,
  retries: 1,
})

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

function clean(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').slice(0, 240)
}

function providerError(provider, status, detail = '') {
  const suffix = status ? ` (HTTP ${status})` : ''
  // Do not echo provider response bodies: they may contain secrets or request data.
  return new Error(`${provider} غير متاح${suffix}${detail ? ': تعذر إكمال الطلب' : ''}`)
}

function isRetryable(error) {
  return error?.name === 'AbortError' || /HTTP (408|425|429|5\d\d)/.test(error?.message || '')
}

async function requestJson(fetchImpl, url, options, { timeoutMs, retries, provider }) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(url, { ...options, signal: controller.signal })
      const raw = await response.text()
      let body = {}
      try { body = raw ? JSON.parse(raw) : {} } catch { body = {} }
      if (!response.ok) throw providerError(provider, response.status, body?.error?.message || body?.error?.status)
      return body
    } catch (error) {
      lastError = error?.name === 'AbortError' ? providerError(provider, 408, 'انتهت المهلة') : error
      if (attempt >= retries || !isRetryable(lastError)) throw lastError
      await sleep(250 * (attempt + 1))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError || providerError(provider)
}

function textFromGemini(body) {
  return (body?.candidates || [])
    .flatMap(candidate => candidate?.content?.parts || [])
    .map(part => part?.text)
    .filter(Boolean)
    .join('')
}

function normalizeParts(input) {
  if (typeof input === 'string') return [{ text: input }]
  if (!Array.isArray(input)) return []
  return input.map(part => {
    if (typeof part === 'string') return { text: part }
    if (part?.type === 'text') return { text: String(part.text || '') }
    if (part?.type === 'image' || part?.mimeType) {
      const data = String(part.data || part.base64 || '').replace(/^data:[^,]+,/, '')
      return { inline_data: { mime_type: part.mimeType || 'image/jpeg', data } }
    }
    return part
  })
}

export function createAIProviders(options = {}) {
  const env = options.env || process.env
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const config = {
    ...DEFAULTS,
    ...(options.defaults || {}),
    ...(env.GEMINI_MODEL ? { geminiModel: String(env.GEMINI_MODEL).trim() } : {})
  }
  if (typeof fetchImpl !== 'function') throw new Error('fetch غير متاح لتشغيل مزودي AI')

  const keys = {
    groq: String(env.GROQ_API_KEY || ''),
    gemini: String(env.GEMINI_API_KEY || ''),
  }

  const status = () => ({
    groq: { configured: Boolean(keys.groq), model: config.groqModel },
    gemini: { configured: Boolean(keys.gemini), model: config.geminiModel },
  })

  async function groqChat({ messages, temperature = 0.7, maxTokens = 1200, timeoutMs = config.timeoutMs, retries = config.retries } = {}) {
    if (!keys.groq) throw providerError('Groq', 401, 'المفتاح غير مضبوط')
    const body = await requestJson(fetchImpl, 'https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${keys.groq}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: config.groqModel, messages, temperature, max_tokens: maxTokens }),
    }, { ...config, timeoutMs, retries, provider: 'Groq' })
    return { provider: 'groq', text: body?.choices?.[0]?.message?.content || '', raw: body }
  }

  async function geminiGenerate({ contents, systemInstruction, temperature = 0.7, maxTokens = 1200, fastFailover = false } = {}) {
    if (!keys.gemini) throw providerError('Gemini', 401, 'المفتاح غير مضبوط')
    const candidates = [...new Map([
      ['v1beta:gemini-3.1-flash-lite', { version: 'v1beta', model: 'gemini-3.1-flash-lite' }],
      ['v1beta:gemini-3.5-flash-lite', { version: 'v1beta', model: 'gemini-3.5-flash-lite' }],
      ['v1beta:gemini-3.8-flash', { version: 'v1beta', model: 'gemini-3.8-flash' }],
      ['v1beta:gemini-2.5-flash-lite', { version: 'v1beta', model: 'gemini-2.5-flash-lite' }],
      ['v1beta:gemini-3.5-flash', { version: 'v1beta', model: 'gemini-3.5-flash' }],
      [`v1beta:${config.geminiModel}`, { version: 'v1beta', model: config.geminiModel }],
    ]).values()]
    // Swarm has a short deadline. Do not let every fallback model spend the
    // full global timeout or retry the same transient failure.
    const geminiRequestConfig = { ...config, timeoutMs: Math.min(config.timeoutMs, 3_500), retries: 0 }
    let lastError
    for (const candidate of candidates) {
      const url = `https://generativelanguage.googleapis.com/${candidate.version}/models/${encodeURIComponent(candidate.model)}:generateContent?key=${encodeURIComponent(keys.gemini)}`
      try {
        const body = await requestJson(fetchImpl, url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
            contents,
            generationConfig: { temperature, maxOutputTokens: maxTokens },
          }),
        }, { ...geminiRequestConfig, provider: 'Gemini' })
        return { provider: 'gemini', model: candidate.model, text: textFromGemini(body), raw: body }
      } catch (error) {
        lastError = error
        // For latency-sensitive chat, route transient failures to the other
        // provider immediately. Keep trying model names only after a 404.
        if (fastFailover && !/HTTP 404/.test(error?.message || '')) throw error
        // A model can be unavailable (404), rate-limited (429), or temporarily
        // unavailable (5xx). Try another listed model before failing.
        if (!/HTTP (404|408|425|429|5\d\d)/.test(error?.message || '')) throw error
      }
    }
    throw lastError || providerError('Gemini', 404)
  }

  async function ask({ task = 'chat', input, messages, systemInstruction, temperature, maxTokens, fallback = true } = {}) {
    const multimodal = task === 'vision' || task === 'document' || Array.isArray(input)
    const primary = multimodal ? 'gemini' : 'groq'
    const secondary = primary === 'groq' ? 'gemini' : 'groq'
    const attempts = fallback ? [primary, secondary] : [primary]
    let lastError
    for (const provider of attempts) {
      try {
        if (provider === 'groq') {
          const userMessages = messages || [{ role: 'user', content: typeof input === 'string' ? input : JSON.stringify(input) }]
          const groqMessages = systemInstruction
            ? [{ role: 'system', content: systemInstruction }, ...userMessages]
            : userMessages
          return await groqChat({ messages: groqMessages, temperature, maxTokens })
        }
        const parts = normalizeParts(input || messages?.at(-1)?.content || '')
        return await geminiGenerate({ contents: [{ role: 'user', parts }], systemInstruction, temperature, maxTokens })
      } catch (error) {
        lastError = error
      }
    }
    throw new Error(`تعذر تنفيذ مهمة AI عبر المزودات المتاحة: ${clean(lastError?.message || 'خطأ غير معروف')}`)
  }

  return Object.freeze({ status, groqChat, geminiGenerate, ask })
}

export const aiProviders = createAIProviders()
export default aiProviders
