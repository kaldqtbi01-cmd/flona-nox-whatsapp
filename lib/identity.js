const participantsByJid = new Map()
const MAX_REMEMBERED_PARTICIPANTS = 10000

function jidFromText(value) {
  const text = String(value ?? '').trim()
  const match = text.match(/(?:^|[^\w])([0-9]{5,24}(?::[0-9]+)?@(s\.whatsapp\.net|lid|g\.us|newsletter))\b/i)
  if (match) return match[1]
  if (/^[0-9]{5,24}$/.test(text)) return `${text}@s.whatsapp.net`
  return null
}

export function normalizeJid(value) {
  if (value && typeof value === 'object') {
    for (const key of ['jid', 'id', 'participant', 'phoneNumber', 'lid', 'user']) {
      const result = normalizeJid(value[key])
      if (result) return result
    }
    return null
  }
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const jid = jidFromText(value)
  if (!jid) return null
  return jid.replace(/:\d+(?=@)/, '').toLowerCase()
}

export function isMentionableJid(value) {
  const jid = normalizeJid(value)
  return !!jid && /@(s\.whatsapp\.net|lid)$/.test(jid)
}

export function extractJidFromParam(value) {
  if (value == null) return null
  if (typeof value === 'object') {
    for (const key of ['jid', 'id', 'participant', 'phoneNumber', 'lid', 'user', 'name', 'text']) {
      const result = extractJidFromParam(value[key])
      if (result) return result
    }
    return null
  }
  return normalizeJid(value)
}

export function asText(value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Buffer.isBuffer(value)) return value.toString('utf8')
  for (const key of ['text', 'name', 'subject', 'displayName', 'notify', 'jid', 'id']) {
    if (typeof value[key] === 'string' || typeof value[key] === 'number') return String(value[key])
  }
  return ''
}

export function rememberParticipants(participants = []) {
  if (!Array.isArray(participants)) return 0
  let remembered = 0
  for (const participant of participants) {
    if (!participant || typeof participant !== 'object') continue
    const ids = ['jid', 'id', 'lid', 'phoneNumber'].map(key => normalizeJid(participant[key])).filter(Boolean)
    for (const id of ids) {
      participantsByJid.set(id, new Set(ids))
      remembered++
      if (participantsByJid.size > MAX_REMEMBERED_PARTICIPANTS) {
        const oldest = participantsByJid.keys().next().value
        participantsByJid.delete(oldest)
      }
    }
  }
  return remembered
}

export function getKnownJidVariants(value) {
  const jid = normalizeJid(value)
  if (!jid) return []
  const variants = participantsByJid.get(jid)
  return variants ? [...variants] : [jid]
}
