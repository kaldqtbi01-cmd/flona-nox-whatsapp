import crypto from 'node:crypto'

export function normalizeJid(value) {
  if (!value || typeof value !== 'string') return ''
  return value.replace(/:[0-9]+(?=@)/, '').trim()
}

export function messageKind(raw = {}) {
  const message = raw.message || raw
  if (message.conversation || message.extendedTextMessage) return 'text'
  if (message.imageMessage) return 'image'
  if (message.videoMessage) return 'video'
  if (message.audioMessage) return 'audio'
  if (message.documentMessage) return 'document'
  if (message.stickerMessage) return 'sticker'
  if (message.reactionMessage) return 'reaction'
  return 'unknown'
}

export function messageText(raw = {}) {
  const m = raw.message || raw
  return String(m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || m.documentMessage?.caption || '').trim()
}

export function normalizeMessage(raw = {}, options = {}) {
  const key = raw.key || {}
  const chatId = normalizeJid(key.remoteJid || raw.chat || '')
  const senderId = normalizeJid(key.participant || raw.participant || key.remoteJid || '')
  const messageId = String(key.id || raw.id || crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex').slice(0, 24))
  const timestamp = Number(raw.messageTimestamp || raw.timestamp || Math.floor(Date.now() / 1000))
  return {
    messageId,
    chatId,
    senderId,
    timestamp: Number.isFinite(timestamp) ? timestamp : Math.floor(Date.now() / 1000),
    text: messageText(raw),
    kind: messageKind(raw),
    quotedId: raw.message?.extendedTextMessage?.contextInfo?.stanzaId || raw.quoted?.id || null,
    isFromMe: key.fromMe === true || raw.fromMe === true,
    isGroup: chatId.endsWith('@g.us'),
    origin: options.origin || (key.fromMe ? 'manual' : 'inbound'),
    media: (() => {
      const m = raw.message || raw
      const item = m.imageMessage || m.videoMessage || m.audioMessage || m.documentMessage || m.stickerMessage
      return item ? { mimetype: item.mimetype || '', fileLength: Number(item.fileLength || 0), seconds: Number(item.seconds || 0) } : null
    })(),
  }
}

export function validateMessageContract(message) {
  return Boolean(message && message.messageId && message.chatId && message.senderId && Number.isFinite(message.timestamp) && typeof message.text === 'string')
}
