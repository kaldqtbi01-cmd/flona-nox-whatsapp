import { normalizeJid } from './identity.js'

const VIEW_ONCE_WRAPPERS = [
  'viewOnceMessageV2Extension',
  'viewOnceMessageV2',
  'viewOnceMessage',
]
const TRANSPARENT_WRAPPERS = [
  'ephemeralMessage',
  'documentWithCaptionMessage',
]
const MEDIA_TYPES = [
  ['imageMessage', 'image'],
  ['videoMessage', 'video'],
  ['audioMessage', 'audio'],
]

function unwrap(message) {
  let current = message || {}
  let hasViewOnceWrapper = false
  for (let depth = 0; depth < 12 && current; depth++) {
    const viewOnceKey = VIEW_ONCE_WRAPPERS.find(key => current[key]?.message)
    if (viewOnceKey) {
      hasViewOnceWrapper = true
      current = current[viewOnceKey].message
      continue
    }
    const transparentKey = TRANSPARENT_WRAPPERS.find(key => current[key]?.message)
    if (transparentKey) {
      current = current[transparentKey].message
      continue
    }
    break
  }
  return { message: current, hasViewOnceWrapper }
}

export function hasViewOnceWrapper(message) {
  return unwrap(message).hasViewOnceWrapper
}

export function findViewOnceMedia(message) {
  const { message: content, hasViewOnceWrapper } = unwrap(message)
  for (const [key, type] of MEDIA_TYPES) {
    const media = content?.[key]
    if (!media) continue
    if (!hasViewOnceWrapper && media.viewOnce !== true) continue
    return { key, type, message: media }
  }
  return null
}

export function getPrimaryOwnerJid(owners) {
  const owner = Array.isArray(owners) ? owners[0] : owners
  const jid = normalizeJid(owner)
  if (!jid || !/@(?:s\.whatsapp\.net|lid)$/.test(jid)) return null
  return jid
}

export function isViewOnceAutoEnabled(value) {
  if (value === undefined || value === null) return true
  return value === true || value === 'on'
}
