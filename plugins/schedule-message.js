import { randomUUID } from 'node:crypto';
import { parseReminderDelay } from '../lib/reminders.js';

async function deliverScheduledMessages() {
  const db = global.db;
  const conn = global.conn;
  if (!db?.data || !conn?.sendMessage || global.stopped !== 'open') return;
  if (!Array.isArray(db.data.scheduledMessages)) db.data.scheduledMessages = [];
  const now = Date.now();
  const due = [];
  db.data.scheduledMessages = db.data.scheduledMessages.filter(item => {
    if (Number(item.dueAt) <= now) { due.push(item); return false; }
    return true;
  });
  for (const item of due) {
    try {
      await conn.sendMessage(item.chat, { text: `⏰ *رسالة مجدولة*\n\n${item.text}`, ...(item.sender ? { mentions: [item.sender] } : {}) });
    } catch (error) {
      item.dueAt = Date.now() + 60_000;
      db.data.scheduledMessages.push(item);
      console.error('[scheduled-message] تعذر الإرسال:', error?.message || error);
    }
  }
}

if (global.__flonaScheduleMessagePump) clearInterval(global.__flonaScheduleMessagePump);
global.__flonaScheduleMessagePump = setInterval(() => { void deliverScheduledMessages(); }, 15_000);
global.__flonaScheduleMessagePump.unref?.();

const handler = async (m, { text, usedPrefix }) => {
  const db = global.db;
  if (!db?.data) return m.reply('قاعدة البيانات غير جاهزة.');
  if (!Array.isArray(db.data.scheduledMessages)) db.data.scheduledMessages = [];
  const [action, ...rest] = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (/^(قائمة|list)$/i.test(action || '')) {
    const entries = db.data.scheduledMessages.filter(x => x.chat === m.chat && x.sender === m.sender);
    return m.reply(entries.length ? `📨 *رسائلك المجدولة*\n${entries.map(x => `• ${x.id.slice(0, 8)} — ${new Date(x.dueAt).toLocaleString('ar')}: ${x.text.slice(0, 70)}`).join('\n')}` : 'ما عندك رسائل مجدولة في هذه المحادثة.');
  }
  if (/^(الغاء|إلغاء|حذف|cancel)$/i.test(action || '')) {
    const id = rest[0];
    const index = db.data.scheduledMessages.findIndex(x => x.chat === m.chat && x.sender === m.sender && x.id.startsWith(id || '!'));
    if (index < 0) return m.reply(`لم أجد الجدولة. استخدم ${usedPrefix}جدولة قائمة لعرض المعرّفات.`);
    db.data.scheduledMessages.splice(index, 1);
    return m.reply('تم إلغاء الرسالة المجدولة.');
  }
  const delayMs = parseReminderDelay(action);
  if (!delayMs) return m.reply(`📨 *جدولة رسالة نصية*\nاستخدم: ${usedPrefix}جدولة <مدة> <النص>\nمثال: ${usedPrefix}جدولة 2h اجتماع الفريق\nالمدد: 10د، 2س، 1ي (حتى 30 يومًا).\n${usedPrefix}جدولة قائمة — عرض الرسائل\n${usedPrefix}جدولة إلغاء <المعرّف> — إلغاء رسالة`);
  const messageText = rest.join(' ').trim() || String(m.quoted?.text || m.quoted?.caption || '').trim();
  if (!messageText) return m.reply('اكتب نص الرسالة بعد المدة، أو رد على رسالة نصية ثم اكتب المدة.');
  if (messageText.length > 1500) return m.reply('النص طويل؛ الحد الأقصى 1500 حرف.');
  const active = db.data.scheduledMessages.filter(x => x.chat === m.chat && x.sender === m.sender);
  if (active.length >= 15) return m.reply('وصلت الحد الأقصى وهو 15 رسالة مجدولة لك في هذه المحادثة.');
  const item = { id: randomUUID(), chat: m.chat, sender: m.sender, text: messageText, createdAt: Date.now(), dueAt: Date.now() + delayMs };
  db.data.scheduledMessages.push(item);
  return m.reply(`✅ تم حفظ الرسالة.\nموعد الإرسال: ${new Date(item.dueAt).toLocaleString('ar')}\nالمعرّف: ${item.id.slice(0, 8)}`);
};

handler.help = ['جدولة <مدة> <نص>'];
handler.tags = ['tools'];
handler.command = /^(جدولة|schedulemsg)$/i;
export default handler;
