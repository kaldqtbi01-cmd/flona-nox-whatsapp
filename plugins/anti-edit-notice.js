const handler = async (m, { text, chat, isAdmin, isROwner, usedPrefix }) => {
  if (!m.isGroup) return m.reply('هذا الأمر يعمل داخل المجموعات فقط.');
  if (!isAdmin && !isROwner) return m.reply('تفعيل هذه الميزة متاح لمشرفي المجموعة فقط.');
  const value = String(text || '').trim().toLowerCase();
  if (!/^(on|off|تشغيل|ايقاف|إيقاف)$/.test(value)) {
    const enabled = Boolean(chat?.antiEditNotice);
    return m.reply(`تنبيه تعديل الرسائل: ${enabled ? 'مفعّل' : 'متوقف'}\nاستخدم: ${usedPrefix}مضاد_تعديل تشغيل أو إيقاف`);
  }
  if (!chat) return m.reply('تعذر تحميل إعدادات المجموعة.');
  chat.antiEditNotice = /^(on|تشغيل)$/.test(value);
  return m.reply(chat.antiEditNotice ? 'تم تفعيل تنبيه تعديل الرسائل في هذه المجموعة.' : 'تم إيقاف تنبيه تعديل الرسائل في هذه المجموعة.');
};

handler.help = ['مضاد_تعديل <تشغيل|إيقاف>'];
handler.tags = ['group'];
handler.command = /^(مضاد_تعديل|antiedit)$/i;
export default handler;
