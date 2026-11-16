import { cancelReminder, createReminder, parseReminderDelay, takeDueReminders } from '../lib/reminders.js'

async function deliverDueReminders() {
  const db = global.db
  const conn = global.conn
  if (!db?.data || !conn?.sendMessage || global.stopped !== 'open') return
  const due = takeDueReminders(db)
  for (const reminder of due) {
    try {
      const number = String(reminder.sender).split('@')[0]
      await conn.sendMessage(reminder.chat, {
        text: `⏰ *تذكير*\n@${number}\n\n${reminder.text}`,
        mentions: [reminder.sender]
      })
    } catch (error) {
      if (!Array.isArray(db.data.reminders)) db.data.reminders = []
      db.data.reminders.push(reminder)
      console.error('[reminder] تعذر إرسال تذكير؛ سيعاد لاحقًا:', error?.message || error)
    }
  }
}

if (global.__flonaReminderPump) clearInterval(global.__flonaReminderPump)
global.__flonaReminderPump = setInterval(() => { void deliverDueReminders() }, 15_000)
global.__flonaReminderPump.unref?.()

const handler = async (m, { text, usedPrefix }) => {
  const input = String(text || '').trim()
  const [action, ...tail] = input.split(/\s+/).filter(Boolean)
  const db = global.db
  if (/^(قائمة|list)$/i.test(action || '')) {
    const items = (db?.data?.reminders || []).filter(item => item.chat === m.chat && item.sender === m.sender)
    if (!items.length) return m.reply('لا توجد لك تذكيرات نشطة في هذه المحادثة.')
    return m.reply(`⏰ *تذكيراتك النشطة*\n\n${items.map(item => `• ${item.id} — ${new Date(item.dueAt).toLocaleString('ar')}: ${item.text}`).join('\n')}`)
  }
  if (/^(إلغاء|الغاء|cancel)$/i.test(action || '')) {
    const id = tail[0]
    if (!id) return m.reply(`استخدم: ${usedPrefix}تذكير إلغاء <معرّف>`)
    return m.reply(cancelReminder(db, { chat: m.chat, sender: m.sender, id }) ? '✅ ألغيت التذكير.' : 'لم أجد تذكيرًا بهذا المعرّف في هذه المحادثة.')
  }
  const delayMs = parseReminderDelay(action)
  if (!delayMs) return m.reply(`⏰ *طريقة الاستخدام*\n${usedPrefix}تذكير <المدة> <النص>\nمثال: ${usedPrefix}تذكير 30m موعد الاجتماع\nالمدد: 5m أو 2h أو 1d، حتى 30 يومًا.\n${usedPrefix}تذكير قائمة — عرض تذكيراتك\n${usedPrefix}تذكير إلغاء <المعرّف> — إلغاء تذكير`)
  const reminderText = tail.join(' ').trim()
  if (!reminderText) return m.reply('اكتب نص التذكير بعد المدة.')
  try {
    const reminder = createReminder(db, { chat: m.chat, sender: m.sender, text: reminderText, delayMs })
    const when = new Date(reminder.dueAt).toLocaleString('ar')
    return m.reply(`✅ حفظت تذكيرك.\nالموعد: ${when}\nالمعرّف: ${reminder.id}`)
  } catch (error) {
    return m.reply(error.message || 'تعذر حفظ التذكير.')
  }
}

handler.help = ['تذكير <مدة> <نص>', 'تذكير قائمة', 'تذكير إلغاء <معرّف>']
handler.tags = ['main']
handler.command = /^(تذكير|remind|reminder)$/i
export default handler
