const handler = async (m, { conn, groupMetadata, participants = [] }) => {
  try {
    const metadata = groupMetadata?.subject
      ? groupMetadata
      : await conn.groupMetadata(m.chat);
    const members = participants.length ? participants : (metadata.participants || []);
    const ownerId = String(metadata.owner || '').split('@')[0].split(':')[0];
    const botId = String(conn.user?.id || conn.user?.jid || '').split('@')[0].split(':')[0];
    const owner = !ownerId ? 'غير متاح' : (ownerId === botId ? 'البوت (منشئ المجموعة)' : ownerId);
    const adminCount = members.filter(member => member.admin).length;
    const description = String(metadata.desc || '').trim() || 'لا يوجد وصف';
    const text = [
      `👥 *معلومات المجموعة: ${metadata.subject || 'بدون اسم'}*`,
      `عدد الأعضاء: ${members.length}`,
      `عدد المشرفين: ${adminCount}`,
      `المالك: ${owner}`,
      `الوصف: ${description}`
    ].join('\n');
    await conn.sendMessage(m.chat, { text }, { quoted: m });
  } catch (error) {
    console.error('[معلومات المجموعة]', error?.message || error);
    await m.reply('❌ تعذر جلب معلومات المجموعة؛ أعد المحاولة.');
  }
};

handler.help = ['معلومات_المجموعة'];
handler.tags = ['group'];
handler.command = /^(معلومات_المجموعة|معلومات_الجروب)$/i;
handler.group = true;

export default handler;
