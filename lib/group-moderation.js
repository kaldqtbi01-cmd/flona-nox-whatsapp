const ARABIC_DIGITS = Object.freeze({ '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' })

export function parseModerationDuration(input) {
  const value = String(input || '').replace(/[٠-٩]/g, digit => ARABIC_DIGITS[digit]).trim()
  const match = value.match(/^(\d{1,5})\s*(m|min|mins|minute|minutes|د|دقيقة|دقائق|دقيقه|h|hr|hrs|hour|hours|س|ساعة|ساعات|d|day|days|ي|يوم|أيام|ايام)$/i)
  if (!match) return null
  const amount = Number(match[1])
  if (!Number.isSafeInteger(amount) || amount <= 0) return null
  const unit = match[2].toLocaleLowerCase()
  const multiplier = /^(m|min|mins|minute|minutes|د|دقيقة|دقائق|دقيقه)$/i.test(unit)
    ? 60_000
    : /^(h|hr|hrs|hour|hours|س|ساعة|ساعات)$/i.test(unit)
      ? 3_600_000
      : 86_400_000
  return amount * multiplier
}

export function isTemporarilyMuted(chat, jid, now = Date.now()) {
  const mutedUsers = chat?.mutedUsers
  if (!mutedUsers || !jid) return false
  const key = String(jid).replace(/:\d+(?=@)/, '')
  const until = Number(mutedUsers[key] || 0)
  if (!Number.isFinite(until) || until <= now) {
    delete mutedUsers[key]
    return false
  }
  return true
}
