const handler = async (m, { text }) => {
  const uid = String(text || '').trim().replace(/\D/g, '');
  if (!/^\d{6,12}$/.test(uid)) return m.reply('اكتب UID صحيحًا لحساب Genshin الذي يشارك بيانات ملفه علنًا.\nمثال: .حساب_جينشن 800000000');
  try {
    const response = await fetch(`https://enka.network/api/uid/${uid}`, { headers: { 'User-Agent': 'FlonaBot/1.0 (public profile lookup)' }, signal: AbortSignal.timeout(12_000) });
    if (response.status === 404) return m.reply('لم أجد ملفًا عامًا بهذا الرقم. تأكد من تفعيل عرض الشخصيات في اللعبة.');
    if (!response.ok) throw new Error(`خدمة Enka أعادت الحالة ${response.status}`);
    const data = await response.json();
    const info = data.playerInfo || {};
    const chars = Array.isArray(info.showAvatarInfoList) ? info.showAvatarInfoList : [];
    const charLines = chars.slice(0, 8).map(c => `• ${c.name || `الشخصية ${c.avatarId}`} — مستوى ${c.level ?? '؟'}`).join('\n');
    return m.reply(`🎮 *ملف Genshin Impact العام*\nUID: ${uid}\nالاسم: ${info.nickname || 'غير معلن'}\nمستوى المغامرة: ${info.level ?? 'غير معلن'}\nمستوى العالم: ${info.worldLevel ?? 'غير معلن'}\nالإنجازات: ${info.finishAchievementNum ?? 'غير معلن'}\n\n*الشخصيات المعروضة:*\n${charLines || 'لا توجد شخصيات ظاهرة للعامة.'}\n\nالمعلومات متاحة فقط إذا كان صاحب الحساب قد جعلها عامة.`);
  } catch (error) {
    console.error('[حساب جينشن]', error?.message || error);
    return m.reply('تعذر جلب الملف الآن. قد تكون خدمة Enka متوقفة أو يوجد حد مؤقت للطلبات.');
  }
};
handler.help = ['حساب_جينشن <UID>'];
handler.tags = ['games'];
handler.command = /^(حساب_جينشن|genshinstalk|gistalk)$/i;
export default handler;
