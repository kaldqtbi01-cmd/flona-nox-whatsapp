/*
 * FLONA BOT — حفظ وسائط ViewOnce وإرسالها تلقائيًا إلى محادثة المالك الخاصة.
 * يستقبل الرسائل الواردة فقط، ولا يقتبس رسالة المجموعة عند إعادة الإرسال.
 */

import { downloadContentFromMessage, downloadMediaMessage } from '@whiskeysockets/baileys'
import { findViewOnceMedia, getPrimaryOwnerJid, isViewOnceAutoEnabled } from '../lib/view-once.js'

const VIEW_ONCE_WRAPPERS = [
  'viewOnceMessageV2Extension',
  'viewOnceMessageV2',
  'viewOnceMessage',
]

function hasViewOnceWrapper(message) {
  let current = message || {}
  for (let depth = 0; depth < 12 && current; depth++) {
    const viewOnceKey = VIEW_ONCE_WRAPPERS.find(key => current[key]?.message)
    if (viewOnceKey) return true
    const transparentKey = ['ephemeralMessage', 'documentWithCaptionMessage']
      .find(key => current[key]?.message)
    if (transparentKey) {
      current = current[transparentKey].message
      continue
    }
    break
  }
  return false
}

const processedMessages = new Map()
const MAX_PROCESSED_MESSAGES = 5000

function claimMessage(key) {
  if (processedMessages.has(key)) return false
  processedMessages.set(key, Date.now())
  if (processedMessages.size > MAX_PROCESSED_MESSAGES) {
    const oldestKey = processedMessages.keys().next().value
    processedMessages.delete(oldestKey)
  }
  return true
}

function releaseMessage(key) { processedMessages.delete(key) }

function mediaOptions(conn) {
  return {
    logger: { info() {}, error() {}, warn() {}, debug() {} },
    ...(typeof conn.updateMediaMessage === 'function'
      ? { reuploadRequest: conn.updateMediaMessage.bind(conn) }
      : {}),
  }
}

async function downloadViewOnce(conn, m, media) {
  const errors = []
  try {
    const buffer = await downloadMediaMessage(m, 'buffer', {}, mediaOptions(conn))
    if (Buffer.isBuffer(buffer) && buffer.length > 0) return buffer
    errors.push('downloadMediaMessage: نتيجة فارغة')
  } catch (error) { errors.push(`downloadMediaMessage: ${error?.message || error}`) }

  try {
    const stream = await downloadContentFromMessage(media.message, media.type)
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)
    if (buffer.length > 0) return buffer
    errors.push('downloadContentFromMessage: نتيجة فارغة')
  } catch (error) { errors.push(`downloadContentFromMessage: ${error?.message || error}`) }

  throw new Error(errors.join(' | '))
}

function sourceLabel(m, groupMetadata) {
  if (!m.isGroup) return 'محادثة خاصة'
  const subject = String(groupMetadata?.subject || '').trim().slice(0, 80)
  return subject ? `مجموعة: ${subject}` : 'مجموعة'
}

function captionFor(m, groupMetadata, media) {
  const sender = String(m.pushName || m.name || '').trim().slice(0, 80)
  return [
    '👁️ وسائط عرض لمرة واحدة محفوظة لـ FLONA',
    sender ? `المرسل: ${sender}` : null,
    `المصدر: ${sourceLabel(m, groupMetadata)}`,
    media.message.caption?.trim() || null,
    '🪻 『 𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓 』',
  ].filter(Boolean).join('\n\n')
}

async function forwardToOwner(conn, ownerJid, buffer, media, caption) {
  if (media.type === 'image') return conn.sendMessage(ownerJid, { image: buffer, ...(media.message.mimetype ? { mimetype: media.message.mimetype } : {}), caption })
  if (media.type === 'video') return conn.sendMessage(ownerJid, { video: buffer, mimetype: media.message.mimetype || 'video/mp4', caption })
  await conn.sendMessage(ownerJid, { audio: buffer, mimetype: media.message.mimetype || 'audio/ogg; codecs=opus', ptt: media.message.ptt === true })
  await conn.sendMessage(ownerJid, { text: caption })
}

const handler = async () => {}

handler.all = async function (m, { settings, groupMetadata }) {
  if (!m?.message || m.fromMe || m.key?.fromMe) return
  if (!isViewOnceAutoEnabled(settings?.viewOnceAuto)) return
  if (!m.chat || m.chat === 'status@broadcast' || m.chat.endsWith('@newsletter')) return

  const media = findViewOnceMedia(m.message)
  if (!media && !hasViewOnceWrapper(m.message)) return
  const messageId = m.key?.id
  if (!messageId) return
  const dedupeKey = `${m.chat}:${messageId}`
  if (!claimMessage(dedupeKey)) return

  const ownerJid = getPrimaryOwnerJid(global.owner)
  if (!ownerJid) {
    releaseMessage(dedupeKey)
    console.error('[VIEWONCE] تعذر تحديد JID المالك الأساسي من إعدادات global.owner')
    return
  }

  if (!media) {
    console.warn(`[VIEWONCE] رُصد غلاف دون صورة/فيديو/صوت قابل للتنزيل: ${messageId}`)
    await this.sendMessage(ownerJid, { text: '⚠️ وصلت رسالة ViewOnce لكن لم تصل معها بيانات صورة أو فيديو أو صوت قابلة للحفظ. جرّب إرسال وسائط جديدة بعد إعادة تشغيل البوت؛ قد يرسل Baileys إشعارًا مختصرًا فقط.' }).catch(() => {})
    return
  }

  try {
    const buffer = await downloadViewOnce(this, m, media)
    await forwardToOwner(this, ownerJid, buffer, media, captionFor(m, groupMetadata, media))
    console.log(`[VIEWONCE] تم إرسال وسائط الرسالة ${messageId} إلى المالك`)
  } catch (error) {
    releaseMessage(dedupeKey)
    console.error(`[VIEWONCE] فشل حفظ الرسالة ${messageId}:`, error?.message || error)
    await this.sendMessage(ownerJid, { text: '⚠️ رصد FLONA رسالة ViewOnce، لكنه لم يستطع تنزيل الوسائط. راجع سجل البوت عند [VIEWONCE] أو أرسل وسائط جديدة بعد إعادة تشغيله.' }).catch(() => {})
  }
}

export default handler
