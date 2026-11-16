import { downloadContentFromMessage, downloadMediaMessage } from '@whiskeysockets/baileys'
import { smsg } from './simple.js'
import { findViewOnceMedia, getPrimaryOwnerJid, isViewOnceAutoEnabled } from './view-once.js'

const seen = new Map()
const wrappers = ['viewOnceMessageV2Extension', 'viewOnceMessageV2', 'viewOnceMessage']
const transparent = ['ephemeralMessage', 'documentWithCaptionMessage']

function isViewOnceMessage(message) {
  let current = message || {}
  for (let depth = 0; depth < 12 && current; depth++) {
    const wrapper = wrappers.find(key => current[key]?.message)
    if (wrapper) return true
    const nested = transparent.find(key => current[key]?.message)
    if (!nested) break
    current = current[nested].message
  }
  return false
}

function claim(key) {
  if (seen.has(key)) return false
  seen.set(key, Date.now())
  if (seen.size > 5000) seen.delete(seen.keys().next().value)
  return true
}

function ownerJid() {
  return getPrimaryOwnerJid(global.owner)
}

async function download(conn, message, media) {
  try {
    const options = {
      logger: { info() {}, warn() {}, error() {}, debug() {} },
    }
    if (typeof conn.updateMediaMessage === 'function') {
      options.reuploadRequest = conn.updateMediaMessage.bind(conn)
    }
    const buffer = await downloadMediaMessage(message, 'buffer', {}, {
      ...options,
    })
    if (Buffer.isBuffer(buffer) && buffer.length) return buffer
  } catch (error) {
    console.warn('[VIEWONCE DIRECT] downloadMediaMessage:', error?.message || error)
  }

  const stream = await downloadContentFromMessage(media.message, media.type)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  const buffer = Buffer.concat(chunks)
  if (!buffer.length) throw new Error('نتيجة تنزيل فارغة')
  return buffer
}

async function sendMedia(conn, owner, buffer, media, caption) {
  if (media.type === 'image') return conn.sendMessage(owner, { image: buffer, caption })
  if (media.type === 'video') return conn.sendMessage(owner, { video: buffer, mimetype: media.message.mimetype || 'video/mp4', caption })
  await conn.sendMessage(owner, { audio: buffer, mimetype: media.message.mimetype || 'audio/ogg; codecs=opus', ptt: media.message.ptt === true })
  await conn.sendMessage(owner, { text: caption })
}

export async function captureViewOnceUpdate(conn, update) {
  const settings = global.db?.data?.settings?.[conn.user?.jid] || {}
  if (!isViewOnceAutoEnabled(settings.viewOnceAuto)) return
  const owner = ownerJid()
  if (!owner) {
    console.error('[VIEWONCE DIRECT] لا يوجد مالك صالح في global.owner')
    return
  }

  for (const raw of update?.messages || []) {
    if (!raw?.message || raw.key?.fromMe || raw.key?.remoteJid === 'status@broadcast') continue
    const message = smsg(conn, raw)
    if (!message?.message || !isViewOnceMessage(message.message)) continue
    const id = message.key?.id
    const key = `${message.chat}:${id}`
    if (!id || !claim(key)) continue

    const media = findViewOnceMedia(message.message)
    console.log(`[VIEWONCE DIRECT] تم رصد رسالة ${id}; media=${media?.type || 'غير متاح'}`)
    if (!media) {
      await conn.sendMessage(owner, { text: '⚠️ رصد FLONA رسالة ViewOnce، لكن WhatsApp أرسل الغلاف دون ملف الوسائط.' }).catch(() => {})
      continue
    }

    const caption = [
      '👁️ وسائط ViewOnce محفوظة تلقائيًا بواسطة FLONA',
      message.pushName ? `المرسل: ${message.pushName}` : null,
      message.isGroup ? 'المصدر: مجموعة' : 'المصدر: محادثة خاصة',
      media.message.caption?.trim() || null,
    ].filter(Boolean).join('\n\n')

    try {
      const buffer = await download(conn, message, media)
      await sendMedia(conn, owner, buffer, media, caption)
      console.log(`[VIEWONCE DIRECT] تم إرسال ${id} إلى المالك`)
    } catch (error) {
      console.error(`[VIEWONCE DIRECT] فشل ${id}:`, error?.message || error)
      await conn.sendMessage(owner, { text: '⚠️ رصد FLONA ViewOnce، لكن تعذر تنزيل الملف من WhatsApp.' }).catch(() => {})
    }
  }
}
