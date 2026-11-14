/*
 * 🪻 FLONA BOT — كشف الوسائط ذات العرض لمرة واحدة
 * يدعم viewOnceMessage و V2 و V2Extension و ephemeral.
 */

import {
  downloadContentFromMessage,
  downloadMediaMessage,
  proto,
} from '@whiskeysockets/baileys'

const WRAPPERS = [
  'viewOnceMessageV2Extension',
  'viewOnceMessageV2',
  'viewOnceMessage',
]

const MEDIA = [
  ['imageMessage', 'image'],
  ['videoMessage', 'video'],
  ['audioMessage', 'audio'],
]

function timeout(task, ms = 15_000) {
  return Promise.race([
    Promise.resolve().then(task),
    new Promise((_, reject) => setTimeout(() => reject(new Error('انتهت مهلة تنزيل الوسائط')), ms)),
  ])
}

function quotedRaw(m) {
  return m.msg?.contextInfo?.quotedMessage || m.quoted?.vM?.message || {}
}

function unwrap(message) {
  let current = message || {}
  let changed = true
  while (changed && current) {
    changed = false
    for (const name of WRAPPERS) {
      if (current[name]?.message) {
        current = current[name].message
        changed = true
        break
      }
    }
    if (!changed && current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message
      changed = true
    }
    if (!changed && current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message
      changed = true
    }
  }
  return current || {}
}

function findMedia(m) {
  const inner = unwrap(quotedRaw(m))
  for (const [key, type] of MEDIA) {
    if (inner[key]) {
      return { key, type, message: { ...inner[key] } }
    }
  }

  // بعض نسخ simple.js تفك الغلاف داخل m.quoted مباشرة.
  for (const [key, type] of MEDIA) {
    const value = m.quoted?.[key]
    if (value) return { key, type, message: { ...value } }
  }
  return null
}

async function readStream(message, type) {
  if (!message?.url && !message?.directPath) throw new Error('رابط الوسائط غير موجود')
  const stream = await downloadContentFromMessage(message, type)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  const buffer = Buffer.concat(chunks)
  if (buffer.length < 100) throw new Error('الملف الذي تم تنزيله فارغ')
  return buffer
}

async function downloadMedia(conn, m, media) {
  const errors = []

  const methods = [
    ['downloadM', () => conn.downloadM?.(media.message, media.type)],
    ['stream', () => readStream(media.message, media.type)],
    ['downloadMediaMessage', async () => {
      const original = m.quoted?.vM || m.quoted?.fakeObj
      if (!original) throw new Error('بيانات الرسالة الأصلية غير موجودة')
      const fake = proto.WebMessageInfo.fromObject({
        key: original.key,
        message: { [media.key]: media.message },
        ...(m.isGroup ? { participant: m.quoted.sender } : {}),
      })
      return downloadMediaMessage(fake, 'buffer', {}, {
        logger: { info() {}, error() {}, warn() {}, debug() {} },
        reuploadRequest: conn.updateMediaMessage?.bind(conn),
      })
    }],
  ]

  for (const [name, method] of methods) {
    try {
      const result = await timeout(method)
      if (Buffer.isBuffer(result) && result.length > 100) return result
      if (result?.length > 100) return Buffer.from(result)
      throw new Error('النتيجة فارغة')
    } catch (error) {
      errors.push(`${name}: ${error?.message || error}`)
      console.warn(`[VIEWONCE] ${name} failed: ${error?.message || error}`)
    }
  }

  throw new Error(errors.join(' | '))
}

const handler = async (m, { conn }) => {
  const react = async text => {
    try { await conn.sendMessage(m.chat, { react: { text, key: m.key } }) } catch {}
  }

  if (!m.quoted) {
    await react('❌')
    return m.reply('❌ اعمل رد على صورة أو فيديو ViewOnce أولًا، ثم أرسل .فضح')
  }

  const media = findMedia(m)
  if (!media) {
    await react('❌')
    return m.reply('❌ لم أتعرف على الرسالة كوسائط ViewOnce. أرسل ViewOnce جديدة واعمل ردًا عليها مباشرة.')
  }

  await react('⏳')

  try {
    const buffer = await downloadMedia(conn, m, media)
    const caption = '🔓 تم استخراج الوسائط\n> 🪻 『 𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓 』'

    if (media.type === 'image') {
      await conn.sendMessage(m.chat, { image: buffer, caption }, { quoted: m })
    } else if (media.type === 'video') {
      await conn.sendMessage(m.chat, { video: buffer, caption, mimetype: 'video/mp4' }, { quoted: m })
    } else {
      await conn.sendMessage(m.chat, { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: m })
    }
    await react('✅')
  } catch (error) {
    console.error('[VIEWONCE FINAL]', error)
    await react('❌')
    return m.reply('❌ تعذر تنزيل الوسائط. أرسل ViewOnce جديدة، واعمل ردًا عليها فورًا، ثم أرسل .فضح مرة واحدة.')
  }
}

handler.help = ['فضح', 'كشف']
handler.tags = ['tools']
handler.command = /^(فضح|كشف|vv|viewonce|vo)$/i

export default handler
