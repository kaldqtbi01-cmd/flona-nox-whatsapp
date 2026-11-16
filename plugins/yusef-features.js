import axios from 'axios'
import yts from 'yt-search'

const compliments = [
  'أنت شخص رائع ومميز!', 'ابتسامتك تضيء المكان!', 'لديك طاقة إيجابية جميلة!',
  'أنت أقوى مما تتخيل!', 'وجودك يجعل اليوم أجمل!', 'روحك جميلة وقلبك طيب!',
  'أنت شخص يُعتمد عليه فعلًا!', 'إبداعك واضح في كل شيء تفعله!'
]

const eightBall = [
  'نعم، بالتأكيد!', 'لا، مستحيل!', 'اسألني لاحقًا.', 'الأمر مؤكد.',
  'الاحتمال ضعيف.', 'بدون أدنى شك.', 'إجابتي: لا.', 'المؤشرات تقول نعم.'
]

const traits = ['ذكي', 'مبدع', 'طموح', 'كريم', 'مرح', 'وفيّ', 'شجاع', 'صبور', 'غامض', 'قيادي', 'متفائل', 'اجتماعي']

function targetFromMessage(m) {
  const mentioned = m.mentionedJid?.[0] || m.msg?.contextInfo?.mentionedJid?.[0]
  const replied = m.quoted?.sender || m.msg?.contextInfo?.participant
  return mentioned || replied || null
}

function pick(list, count = 1) {
  return [...list].sort(() => Math.random() - 0.5).slice(0, count)
}

let handler = async (m, { conn, text, command }) => {
  const arg = String(text || '').trim()
  const target = targetFromMessage(m)
  const mention = target ? `@${target.split('@')[0]}` : null

  if (/^مدح$/i.test(command)) {
    if (!target) return m.reply('🌟 اذكر شخصًا أو اعمل ردًا على رسالته لاستخدام الأمر.')
    return conn.sendMessage(m.chat, { text: `💐 ${mention}، ${compliments[Math.floor(Math.random() * compliments.length)]}`, mentions: [target] }, { quoted: m })
  }

  if (/^شخصية$/i.test(command)) {
    if (!target) return m.reply('🔮 اذكر شخصًا أو اعمل ردًا على رسالته لتحليل شخصيته.')
    const selected = pick(traits, 4)
    const lines = selected.map((trait) => `• ${trait}: ${60 + Math.floor(Math.random() * 41)}%`).join('\n')
    return conn.sendMessage(m.chat, { text: `🔮 *تحليل شخصية ترفيهي*\n\n👤 الشخص: ${mention}\n\n✨ الصفات:\n${lines}\n\n🎯 التقييم العام: ${80 + Math.floor(Math.random() * 21)}%\n\n> النتيجة للترفيه فقط.`, mentions: [target] }, { quoted: m })
  }

  if (/^كرة8$/i.test(command)) {
    if (!arg) return m.reply('🎱 اكتب سؤالك بعد الأمر.\nمثال: .كرة8 هل سأنجح؟')
    return m.reply(`🎱 ${eightBall[Math.floor(Math.random() * eightBall.length)]}`)
  }

  if (/^بحث_يوتيوب$/i.test(command)) {
    if (!arg) return m.reply('🔎 اكتب ما تريد البحث عنه.\nمثال: .بحث_يوتيوب أناشيد')
    try {
      const result = await yts(arg)
      const videos = (result.videos || []).slice(0, 5)
      if (!videos.length) return m.reply('❌ لم أجد نتائج.')
      const body = videos.map((v, i) => `${i + 1}. *${v.title}*\n⏱️ ${v.timestamp}\n🔗 ${v.url}`).join('\n\n')
      return conn.sendMessage(m.chat, { image: { url: videos[0].thumbnail }, caption: `🔎 *نتائج يوتيوب لـ:* ${arg}\n\n${body}` }, { quoted: m })
    } catch {
      return m.reply('❌ تعذر البحث في يوتيوب حاليًا.')
    }
  }

  if (/^صور_دول$/i.test(command)) {
    const countries = ['china', 'indonesia', 'japan', 'korea', 'hijab']
    const country = (arg || '').toLowerCase()
    if (!countries.includes(country)) return m.reply(`🖼️ اختر دولة: ${countries.join('، ')}\nمثال: .صور_دول japan`)
    try {
      const response = await axios.get(`https://shizoapi.onrender.com/api/pies/${country}?apikey=shizo`, { responseType: 'arraybuffer', timeout: 30000 })
      return conn.sendMessage(m.chat, { image: Buffer.from(response.data), caption: `🖼️ صور ${country}` }, { quoted: m })
    } catch {
      return m.reply('❌ تعذر جلب الصورة حاليًا.')
    }
  }

  if (/^جرأة$/i.test(command)) {
    try {
      const { data } = await axios.get('https://shizoapi.onrender.com/api/texts/dare?apikey=shizo', { timeout: 20000 })
      return m.reply(`🔥 *تحدي الجرأة:*\n\n${data?.result || 'لم يصل تحدٍ هذه المرة.'}`)
    } catch {
      return m.reply('❌ تعذر جلب تحدي الجرأة حاليًا.')
    }
  }
}

handler.help = ['مدح @منشن', 'شخصية @منشن', 'كرة8 <سؤال>', 'بحث_يوتيوب <كلمة>', 'صور_دول <الدولة>', 'جرأة']
handler.tags = ['fun', 'downloader', 'image']
handler.command = /^(مدح|شخصية|كرة8|بحث_يوتيوب|صور_دول|جرأة)$/i

export default handler
