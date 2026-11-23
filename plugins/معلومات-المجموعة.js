const handler = async (m, { conn, groupMetadata, participants = [] }) => {
  try {
    const metadata = groupMetadata || await conn.groupMetadata(m.chat);
    const owner = metadata.owner ? `@${metadata.owner.split('@')[0]}` : 'غير متاح';
    const adminCount = participants.filter(member => member.admin).length;
    const description = metadata.desc?.toString().trim() || 'لا يوجد وصف';
    const text = [
      `👥 *معلومات المجموعة: ${metadata.subject || 'بدون اسم'}*`,
      `عدد الأعضاء: ${participants.length || metadata.participants?.length || 0}`,
      `عدد المشرفين: ${adminCount}`,
      `المالك: ${owner}`,
      `الوصف: ${description}`
    ].join('\n');
    const mentions = metadata.owner ? [metadata.owner] : [];
    await conn.sendMessage(m.chat, { text, mentions }, { quoted: m });
  } catch (error) {
    console.error('[معلومات المجموعة]', error);
    await m.reply('❌ تعذر جلب معلومات المجموعة.');
  }
};

handler.help = ['معلومات_المجموعة'];
handler.tags = ['group'];
handler.command = /^(معلومات_المجموعة|معلومات_الجروب)$/i;
handler.group = true;

export default handler;
