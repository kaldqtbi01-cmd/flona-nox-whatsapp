import crypto from 'node:crypto'

export function normalizeText(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('ar').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[إأآ]/g, 'ا').replace(/ـ/g, '').replace(/\s+/g, ' ').trim()
}

export function fingerprint(value) {
  return crypto.createHash('sha256').update(normalizeText(value)).digest('hex')
}

export function detectModeration(message, settings = {}, state = {}) {
  const text = normalizeText(message.text)
  const links = /(https?:\/\/|www\.|chat\.whatsapp\.com|wa\.me\/)/i.test(text)
  const allow = (settings.allowDomains || []).some(domain => text.includes(normalizeText(domain)))
  const badword = (settings.words || []).find(word => text.includes(normalizeText(word))) || null
  const fp = fingerprint(text)
  const repeated = Boolean(state.lastFingerprint && state.lastFingerprint === fp)
  const rapid = Number(state.recentCount || 0) >= Number(settings.burst || 5)
  const violations = []
  if (settings.antiLink && links && !allow) violations.push('link')
  if (badword) violations.push('word')
  if (settings.antiRepeat && repeated) violations.push('repeat')
  if (settings.antiSpam && rapid) violations.push('spam')
  return { violations: [...new Set(violations)], fingerprint: fp, auditOnly: settings.auditOnly !== false }
}
