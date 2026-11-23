const normalize = value => String(value || '').replace(/[\u064B-\u065F\u0670]/g, '').trim().toLocaleLowerCase('ar');

const handler = async (m, { text, command }) => {
  const user = global.db?.data?.users?.[m.sender];
  if (!user) return m.reply('تعذر الوصول لملف المستخدم.');
  const input = String(text || (/^(رجعت|عدت)$/i.test(command || '') ? command : '')).trim();
  if (/^(رجعت|عدت|off|انهاء)$/i.test(input)) {
    if (!user.afk || user.afk < 0) return m.reply('لست في وضع الغياب حاليًا.');
    const elapsed = Math.max(0, Date.now() - user.afk);
    user.afk = -1;
    user.afkReason = '';
    return m.reply(`أهلًا بعودتك! انتهى وضع الغياب بعد ${Math.round(elapsed / 60000)} دقيقة.`);
  }
  user.afk = Date.now();
  user.afkReason = input.slice(0, 180);
  return m.reply(`تم تفعيل وضع الغياب${user.afkReason ? `، السبب: ${user.afkReason}` : ''}. أرسل «رجعت» لإيقافه.`);
};

handler.all = async function (m) {
  if (!m?.sender || !m?.chat || !m?.key?.id) return;
  const users = global.db?.data?.users || {};
  const now = Date.now();
  const commandText = normalize(m.text).replace(/^[^\p{L}\p{N}]+/u, '');
  const isAfkCommand = /^(غائب|afk|رجعت|عدت)(\s|$)/i.test(commandText);
  if (!isAfkCommand) {
    const sender = users[m.sender];
    if (sender && Number(sender.afk) > 0) {
      sender.afk = -1;
      const reason = sender.afkReason ? ` بسبب: ${sender.afkReason}` : '';
      sender.afkReason = '';
      await this.sendMessage(m.chat, { text: `مرحبًا بعودتك! تم إلغاء غيابك${reason}.` }, { quoted: m }).catch(() => {});
    }
  }
  const key = `${m.chat}:${m.key.id}`;
  if (global.__flonaAfkSeen?.has(key)) return;
  global.__flonaAfkSeen ||= new Set();
  global.__flonaAfkSeen.add(key);
  setTimeout(() => global.__flonaAfkSeen?.delete(key), 60_000).unref?.();
  for (const jid of m.mentionedJid || []) {
    const target = users[jid];
    if (!target || Number(target.afk) <= 0) continue;
    const mins = Math.max(1, Math.floor((now - Number(target.afk)) / 60000));
    const why = target.afkReason ? `\nالسبب: ${target.afkReason}` : '';
    await this.sendMessage(m.chat, { text: `ℹ️ هذا العضو في وضع الغياب منذ ${mins} دقيقة.${why}`, mentions: [jid] }, { quoted: m }).catch(() => {});
  }
};

handler.help = ['غائب <السبب>', 'رجعت'];
handler.tags = ['main'];
handler.command = /^(غائب|afk|رجعت|عدت)$/i;
export default handler;
