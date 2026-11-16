let handler = async (m, { conn, usedPrefix = '.', command, text }) => {
  const value = String(text || '').trim().toLowerCase()
  const prefix = usedPrefix || '.'
  let reply

  if (['off', 'إيقاف', 'ايقاف', 'تعطيل'].includes(value)) {
    reply = '✅ هذا الأمر لا يلتقط أو يحفظ وسائط العرض لمرة واحدة؛ لا يلزم تعطيل إضافي.'
  } else if (['on', 'تشغيل', 'تفعيل'].includes(value)) {
    reply = 'ℹ️ لا يمكن لـ FLONA استخراج أو إعادة توجيه محتوى أرسله شخص بخيار العرض لمرة واحدة. اطلب من المرسل إعادة إرسال الوسائط العادية إذا وافق على مشاركتها.'
  } else {
    reply = `ℹ️ ميزة استخراج وسائط العرض لمرة واحدة غير متاحة. استخدم ${prefix}${command} on أو ${prefix}${command} off؛ سيشرح الأمر حدود الميزة دون حفظ الوسائط.`
  }

  try {
    await conn.sendMessage(m.chat, { text: reply }, { quoted: m })
  } catch {
    await conn.sendMessage(m.chat, { text: reply })
  }
}

handler.help = ['مضاد_العرض on/off', 'استخراج_العرض on/off']
handler.tags = ['info']
handler.command = /^(مضاد_العرض|استخراج_العرض|viewonce_تلقائي)$/i

export default handler
