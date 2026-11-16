import { randomUUID } from 'node:crypto'

const ARABIC_DIGITS = Object.freeze({ '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' })
const MAX_REMINDER_DELAY_MS = 30 * 24 * 60 * 60 * 1000

export function parseReminderDelay(input) {
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
  const delay = amount * multiplier
  return delay <= MAX_REMINDER_DELAY_MS ? delay : null
}

export function createReminder(db, { chat, sender, text, delayMs, now = Date.now(), id = randomUUID() }) {
  if (!db?.data || !chat || !sender || !String(text || '').trim()) throw new Error('بيانات التذكير غير مكتملة.')
  if (String(text).trim().length > 1000) throw new Error('نص التذكير طويل؛ الحد الأقصى 1000 حرف.')
  if (!Number.isSafeInteger(delayMs) || delayMs <= 0 || delayMs > MAX_REMINDER_DELAY_MS) throw new Error('مدة التذكير خارج النطاق المسموح.')
  if (!Array.isArray(db.data.reminders)) db.data.reminders = []
  const inChat = db.data.reminders.filter(item => item.chat === chat)
  if (inChat.length >= 100) throw new Error('وصلت المحادثة للحد الأقصى من التذكيرات النشطة (100).')
  if (inChat.filter(item => item.sender === sender).length >= 20) throw new Error('لديك 20 تذكيرًا نشطًا في هذه المحادثة؛ ألغِ بعضها أولًا.')
  const reminder = { id, chat, sender, text: String(text).trim(), createdAt: now, dueAt: now + delayMs }
  db.data.reminders.push(reminder)
  return reminder
}

export function takeDueReminders(db, now = Date.now()) {
  if (!Array.isArray(db?.data?.reminders)) return []
  const due = []
  const pending = []
  for (const reminder of db.data.reminders) {
    if (Number(reminder?.dueAt) <= now) due.push(reminder)
    else pending.push(reminder)
  }
  db.data.reminders = pending
  return due
}

export function cancelReminder(db, { chat, sender, id }) {
  if (!Array.isArray(db?.data?.reminders)) return false
  const index = db.data.reminders.findIndex(item => item.chat === chat && item.sender === sender && item.id === id)
  if (index < 0) return false
  db.data.reminders.splice(index, 1)
  return true
}
