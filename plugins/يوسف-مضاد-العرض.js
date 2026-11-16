let handler = async (m, { text, command, settings, isOwner }) => {
  if (!isOwner) return m.reply('❌ هذا الإعداد متاح للمالك فقط.')

  const value = String(text || '').trim().toLowerCase()
  const on = ['on', 'تشغيل', 'تفعيل'].includes(value)
  const off = ['off', 'إيقاف', 'ايقاف', 'تعطيل'].includes(value)

  if (!on && !off) {
    const current = settings?.viewOnceAuto !== false && settings?.viewOnceAuto !== 'off'
    return m.reply(
      `👁️ حفظ وسائط العرض لمرة واحدة: ${current ? 'مفعّل' : 'متوقف'}\n` +
      `استخدم .${command} on للتفعيل أو .${command} off للإيقاف.\n` +
      'عند التفعيل تُرسل الوسائط المستعادة إلى محادثة المالك الخاصة.'
    )
  }

  settings.viewOnceAuto = on
  try {
    if (typeof global.db?.write === 'function') await global.db.write()
  } catch (error) {
    console.error('[VIEWONCE] تعذر حفظ الإعداد:', error?.message || error)
    return m.reply('⚠️ تغيّر الإعداد مؤقتًا، لكن تعذر حفظه. حاول مرة أخرى.')
  }

  return m.reply(on
    ? '✅ تم تفعيل الحفظ التلقائي. ستُرسل وسائط العرض لمرة واحدة إلى محادثة المالك الخاصة.'
    : '✅ تم إيقاف الحفظ التلقائي لوسائط العرض لمرة واحدة.'
  )
}

handler.help = ['استخراج_العرض on/off', 'viewonce_تلقائي on/off']
handler.tags = ['tools']
handler.command = /^(مضاد_العرض|استخراج_العرض|viewonce_تلقائي)$/i
handler.owner = true

export default handler
