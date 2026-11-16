/*
 * FLONA BOT — استخراج وسائط View Once.
 * تكييف منطق Atlas للتعرف على الأغلفة والوسائط المفكوكة، مع إبقاء
 * حماية المالك/المطور ومسارات التنزيل المتوافقة مع FLONA.
 */

import {
  downloadContentFromMessage,
  downloadMediaMessage,
  proto,
} from '@whiskeysockets/baileys'
import store from '../lib/store.js'

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

function hasViewOnceWrapper(message) {
  let current = message || {}
  for (let depth = 0; depth < 8 && current; depth++) {
    const wrapper = WRAPPERS.find(name => current[name]?.message)
    if (wrapper) return true
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message
      continue
    }
    if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message
      continue
    }
    break
  }
  return false
}

function unwrap(message) {
  let current = message || {}
  for (let depth = 0; depth < 8 && current; depth++) {
    const wrapper = WRAPPERS.find(name => current[name]?.message)
    if (wrapper) {
      current = current[wrapper].message
      continue
    }
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message
      continue
    }
    if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message
      continue
    }
    break
  }
  return current || {}
}

function findMedia(m) {
  const stored = m.quoted?.id ? store.loadMessage(m.quoted.chat, m.quoted.id) : null
  const raw = stored?.message || m.msg?.contextInfo?.quotedMessage || m.quoted?.vM?.message || {}
  const wrappedViewOnce = hasViewOnceWrapper(raw)
  const storedInner = unwrap(raw)

  // simple.js قد يفك الغلاف تلقائيًا؛ عندها يجب أن تبقى علامة viewOnce موجودة.
  const prepared = m.quoted?.mediaMessage
  const sources = [
    storedInner,
    prepared,
    m.quoted,
  ]

  for (const source of sources) {
    if (!source) continue
    for (const [key, type] of MEDIA) {
      const value = source[key]
      if (!value) continue
      // لا نعامل صورة/فيديو عاديًا على أنه ViewOnce لمجرد الرد عليه.
      if (!wrappedViewOnce && value.viewOnce !== true) continue
      return { key, type, message: { ...value }, stored }
    }
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
    ['quoted.download', () => m.quoted?.download?.()],
    ['downloadM', () => conn.downloadM?.(media.message, media.type)],
    ['stream', () => readStream(media.message, media.type)],
    ['downloadMediaMessage', async () => {
      const original = media.stored || m.quoted?.vM || m.quoted?.fakeObj
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

const handler = async (m, { conn, isOwner, isROwner }) => {
  const react = async text => {
    try { await conn.sendMessage(m.chat, { react: { text, key: m.key } }) } catch {}
  }

  // لا ننقل غياب حاجز الصلاحيات من إضافة Atlas إلى FLONA.
  if (!isOwner && !isROwner)
    return m.reply('❌ أمر استخراج وسائط العرض لمرة واحدة متاح للمالك/المطور فقط.')

  if (!m.quoted) {
    await react('❌')
    return m.reply('❌ رد على صورة أو فيديو ViewOnce، ثم أرسل .فضح')
  }

  const media = findMedia(m)
  if (!media) {
    await react('❌')
    return m.reply('❌ لم أتعرف على الرسالة كوسائط ViewOnce. رد مباشرة على صورة أو فيديو أُرسل للعرض مرة واحدة.')
  }

  await react('⏳')
  try {
    const buffer = await downloadMedia(conn, m, media)
    const originalCaption = media.message.caption?.trim()
    const caption = [
      '👁️ تم استعادة وسائط العرض لمرة واحدة',
      originalCaption,
      '> 🪻 『 𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓 』',
    ].filter(Boolean).join('\n\n')

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
    return m.reply('❌ تعذر تنزيل الوسائط. أرسل ViewOnce جديدة، ورد عليها فورًا ثم أرسل الأمر مرة واحدة.')
  }
}

handler.help = ['فضح', 'كشف']
handler.tags = ['tools']
handler.command = /^(فضح|كشف|vv|viewonce|vo)$/i

export default handler
