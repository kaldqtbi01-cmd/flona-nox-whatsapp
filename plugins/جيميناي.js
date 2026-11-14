// plugins/gemini.js
// 𖤍 YATO BOT MD - Gemini AI Text Chat 🧠💬

import https from 'https'
import fs from 'fs'

const agent = new https.Agent({ keepAlive: true })

function syncCookies(jar, setCookies = []) {
  const list = Array.isArray(setCookies) ? setCookies : [setCookies]
  for (const item of list) {
    const pair = item.split(';')[0].split('=')
    if (pair.length >= 2) {
      jar[pair[0].trim()] = pair.slice(1).join('=').trim()
    }
  }
}
// ᴍᴏᴅᴇ ʙʏ : https://t.me/YatoCoding
const buildCookieString = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')

function cleanText(text) {
  if (!text) return ''
  text = text.replace(/https?:\/\/[a-z0-9.-]*googleusercontent\.com\/[^\s\n"<>]+/gi, '')
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function request(url, { method = 'GET', headers = {}, body = null, stream = false } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: body ? { ...headers, 'content-length': Buffer.byteLength(body) } : headers,
      agent,
      maxHeaderSize: 1048576
    }

    const req = https.request(opts, res => {
      if (stream) return resolve({ res, headers: res.headers })
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ text: Buffer.concat(chunks).toString(), headers: res.headers }))
    })

    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function startSession(cookieStr = null) {
  const cookies = {}

  if (!cookieStr) {
    try {
      if (fs.existsSync('cookies.json')) {
        const cookieData = JSON.parse(fs.readFileSync('cookies.json', 'utf8'))
        if (cookieData && Array.isArray(cookieData.cookies)) {
          cookieData.cookies.forEach(c => cookies[c.name] = c.value)
        }
      }
    } catch (err) {
      console.error('Failed to load cookies.json:', err.message)
    }
  } else {
    for (const pair of cookieStr.split(';')) {
      const idx = pair.indexOf('=')
      if (idx > 0) cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim()
    }
  }

  const pageRes = await request('https://gemini.google.com/app', {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...(Object.keys(cookies).length > 0 ? { 'cookie': buildCookieString(cookies) } : {})
    }
  })
  syncCookies(cookies, pageRes.headers['set-cookie'])

  const cfb2hMatch = pageRes.text.match(/"cfb2h":\s*"(.*?)"/)
  const buildLabel = cfb2hMatch ? cfb2hMatch[1] : 'boq_assistant-bard-web-server_20260709.09_p0'

  const atMatch = pageRes.text.match(/"SNlM0e":"([^"]+)"/)
  const sidMatch = pageRes.text.match(/"FdrFJe":"(-?\d+)"/)
  const atToken = atMatch ? atMatch[1] : null
  const fSid = sidMatch ? sidMatch[1] : null

  const batchRes = await request('https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&hl=en-US&_reqid=1&rt=c', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'cookie': buildCookieString(cookies)
    },
    body: 'f.req=[[["maGuAc","[0]",null,"generic"]]]&'
  })
  syncCookies(cookies, batchRes.headers['set-cookie'])

  const sessionId = Array.from({ length: 19 }, () => Math.floor(Math.random() * 10)).join('')

  return {
    cookies,
    buildLabel,
    sessionId,
    atToken,
    fSid,
    reqId: Math.floor(Math.random() * 90000) + 10000
  }
}

function buildStreamRequest(prompt, metadata, auth) {
  const queryParams = new URLSearchParams({ hl: 'en-US', _reqid: String(auth.reqId), rt: 'c' })
  if (auth.buildLabel) queryParams.set('bl', auth.buildLabel)
  if (auth.fSid) queryParams.set('f.sid', auth.fSid)
  else if (auth.sessionId) queryParams.set('f.sid', auth.sessionId)

  const payload = [
    [prompt, 0, null, null, null, null, 0], ['en-US'],
    metadata, null, null, null, [1], 1, null, null, 1, 0, null, null, null, null, null, [[0]], 1,
    null, null, null, null, null,
    ['', '', '', null, null, null, null, null, 0, null, 1, null, null, null, []],
    null, null, 1, null, null, null, null, null, null, null,
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    1, null, null, null, null, [1]
  ]

  const bodyParams = new URLSearchParams({ 'f.req': JSON.stringify([null, JSON.stringify(payload)]) })
  if (auth.atToken) bodyParams.set('at', auth.atToken)
  const body = bodyParams.toString()

  return {
    url: `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?${queryParams}`,
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'x-same-domain': '1',
      'origin': 'https://gemini.google.com',
      'referer': 'https://gemini.google.com/',
      'cookie': buildCookieString(auth.cookies)
    },
    body
  }
}
// ᴍᴏᴅᴇ ʙʏ : https://t.me/YatoCoding
// ------------------- [ Handler الشات النصي فقط ] -------------------

const handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) {
    return m.reply(`💡 *طريقة الاستخدام:*\n\nاكتب سؤالك بعد الأمر مباشرة، مثال:\n\`${usedPrefix + command} اكتب لي كود بايثون بسيط\`\n\`${usedPrefix + command} من هو ياتو؟\``)
  }

  await conn.sendPresenceUpdate('composing', m.chat)

  try {
    const auth = await startSession()
    const metadata = ['', '', '', null, null, null, null, null, null, '']
    const req = buildStreamRequest(text, metadata, auth)
    
    const { res } = await request(req.url, { method: 'POST', headers: req.headers, body: req.body, stream: true })

    let rawText = ''
    let buf = ''

    res.on('data', chunk => {
      buf += chunk.toString('utf8')
      if (buf.startsWith(")]}'")) buf = buf.substring(4).trimStart()

      while (true) {
        const nl = buf.indexOf('\n')
        if (nl === -1) break
        const size = parseInt(buf.substring(0, nl).trim(), 10)
        if (isNaN(size)) { buf = buf.substring(nl + 1); continue }
        if (buf.length < nl + size) break

        const framePayload = buf.substring(nl, nl + size)
        buf = buf.substring(nl + size)

        try {
          const frameData = JSON.parse(framePayload)
          for (const item of (Array.isArray(frameData) ? frameData : [frameData])) {
            const innerStr = item?.[2]
            if (!innerStr) continue
            const pj = JSON.parse(innerStr)
            for (const cand of (pj?.[4] || [])) {
              const raw = cand?.[1]?.[0] || ''
              if (raw) rawText = raw
            }
          }
        } catch (_) {}
      }
    })

    res.on('end', async () => {
      const result = cleanText(rawText)
      if (result) {
        await m.reply(`🧠 *Gemini AI:*\n\n${result}`)
      } else {
        await m.reply('❌ لم أستطع الحصول على إجابة، حاول صياغة السؤال بشكل آخر.')
      }
    })

  } catch (error) {
    console.error('Gemini Plugin Error:', error)
    await m.reply('❌ حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.')
  }
}

handler.help = ['gemini <سؤال>']
handler.tags = ['ai']
handler.command = /^(جيميناي|gemini|جيميني|ai)$/i

export default handler