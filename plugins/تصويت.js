const handler = async (m, { conn, text, usedPrefix, command }) => {
  const parts = typeof text === 'string' ? text.split('|').map(value => value.trim()) : [];
  const question = parts.shift() || '';
  const options = parts.filter(Boolean);

  if (!question || options.length < 2) {
    return m.reply(
      `📊 *طريقة الاستخدام:*\n${usedPrefix + command} السؤال|الخيار الأول|الخيار الثاني|...\n\nمثال:\n${usedPrefix + command} ما رأيكم؟|ممتاز|جيد|يحتاج تحسين`
    );
  }
  if (options.length > 12) {
    return m.reply('⚠️ الحد الأقصى هو 12 خيارًا.');
  }
  if (new Set(options).size !== options.length) {
    return m.reply('⚠️ احذف الخيارات المكررة قبل إنشاء التصويت.');
  }

  try {
    // Flona's helper expects each choice as a one-element array.
    await conn.sendPoll(m.chat, question, options.map(option => [option]));
  } catch (error) {
    console.error('[تصويت]', error);
    return m.reply('❌ تعذر إنشاء التصويت في هذه المحادثة.');
  }
};

handler.help = ['تصويت <السؤال>|<خيار 1>|<خيار 2>|...'];
handler.tags = ['group'];
handler.command = /^(تصويت|poll|createpoll|polling)$/i;
handler.group = true;

export default handler;
