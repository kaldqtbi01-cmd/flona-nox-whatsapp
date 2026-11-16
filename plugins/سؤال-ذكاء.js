import axios from 'axios'

const endpoints = [
  q => `https://mistral.stacktoy.workers.dev/?apikey=${encodeURIComponent(process.env.AI_API_KEY || 'Suhail')}&text=${encodeURIComponent(q)}`,
  q => `https://llama.gtech-apiz.workers.dev/?apikey=${encodeURIComponent(process.env.AI_API_KEY || 'Suhail')}&text=${encodeURIComponent(q)}`,
]

let handler = async (m, { text, usedPrefix }) => {
  const query = String(text || '').trim()
  if (!query) return m.reply(`🤖 اكتب سؤالك بعد الأمر\nمثال: ${usedPrefix}سؤال_ذكاء ما عاصمة اليمن؟`)
  await m.reply('🤖 جاري التفكير...')
  for (const makeUrl of endpoints) {
    try {
      const { data } = await axios.get(makeUrl(query), { timeout: 20000 })
      const answer = data?.data?.response || data?.response || data?.result
      if (typeof answer === 'string' && answer.trim()) return m.reply(`🤖 ${answer.trim()}`)
    } catch {}
  }
  return m.reply('❌ تعذر الوصول إلى خدمة الذكاء الاصطناعي حاليًا.')
}

handler.help = ['سؤال_ذكاء <سؤالك>']
handler.tags = ['ai']
handler.command = /^(سؤال_ذكاء|ذكاء_اصطناعي)$/i

export default handler
