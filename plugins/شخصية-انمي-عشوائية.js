const CHARACTERS = [
  'لوفي', 'ناروتو', 'سابو', 'إيس', 'رايلي', 'جيرايا', 'إيتاتشي', 'ساسكي',
  'شيسوي', 'غوهان', 'آيزن', 'نامي', 'روبين', 'كاكاشي', 'ريمورو', 'غوكو',
  'كيلوا', 'غون', 'كورابيكا', 'ميناتو', 'رينجي', 'جيمبي', 'سايتاما',
  'نيزوكو', 'أوراهارا', 'تانجيرو', 'أستا', 'يونو', 'لايت', 'ميكاسا'
]

const handler = async (m) => {
  const character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]
  return m.reply(`🎴 شخصيتك العشوائية من عالم الأنمي: *${character}*`)
}

handler.help = ['كت', 'شخصية_انمي']
handler.tags = ['anime']
handler.command = /^(كت|شخصية_انمي)$/i

export default handler
