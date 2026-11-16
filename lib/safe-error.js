const SECRET_ASSIGNMENT = /((?:api[_-]?key|access[_-]?(?:key|secret|token)|refresh[_-]?token|bot[_-]?token|token|secret|password|passwd|authorization|xi-api-key)\s*[:=]\s*)(["']?)[^\s"'`,;&}]+/gi
const URL_SECRET = /([?&](?:api[_-]?key|key|access[_-]?token|refresh[_-]?token|token|secret|password|auth|authorization)=)[^&#\s]+/gi
const BEARER = /\bBearer\s+[^\s"'`,;]+/gi
const KNOWN_KEY_SHAPES = /\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,})\b/g
const ABSOLUTE_PATH = /(?:\/home\/[^\s:'"`]+|\/(?:tmp|var|root|opt)\/[^\s:'"`]+|\b[A-Za-z]:\\[^\s:'"`]+)/g

/** Return a bounded log-safe error summary without credentials or machine paths. */
export function sanitizeError(error, maxLength = 240) {
  const original = typeof error === 'string' ? error : error?.message || error?.name || 'Unknown error'
  return String(original)
    .replace(BEARER, 'Bearer [REDACTED]')
    .replace(URL_SECRET, '$1[REDACTED]')
    .replace(SECRET_ASSIGNMENT, '$1$2[REDACTED]')
    .replace(KNOWN_KEY_SHAPES, '[REDACTED]')
    .replace(ABSOLUTE_PATH, '[PATH]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, maxLength)
}

/** Preserve deliberate string validation replies, but never expose Error details to chat. */
export function publicPluginError(error) {
  if (typeof error === 'string') return sanitizeError(error, 500)
  return 'تعذّر تنفيذ الأمر حالياً. حاول مرة أخرى لاحقاً.'
}
