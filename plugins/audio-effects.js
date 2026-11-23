import { downloadContentFromMessage } from '@whiskeysockets/baileys'
import { FFMPEG_CONFIG } from '../lib/config.js'
import { applyAudioEffect } from '../lib/ffmpeg.js'

const EFFECTS = new Map([
  ['سريع', 'fast'], ['fast', 'fast'],
  ['بطيء', 'slow'], ['بطي', 'slow'], ['slow', 'slow'],
  ['عميق', 'deep'], ['deep', 'deep'],
  ['صدى', 'echo'], ['echo', 'echo'],
  ['عكس', 'reverse'], ['reverse', 'reverse'],
])
const MAX_ACTIVE_CONVERSIONS = 2
let activeConversions = 0

async function downloadAudio(message) {
  const stream = await downloadContentFromMessage(message, 'audio')
  const chunks = []
  let size = 0

  for await (const chunk of stream) {
    size += chunk.length
    if (size > FFMPEG_CONFIG.maxInputBytes) {
      throw new Error('حجم الصوت أكبر من الحد المسموح.')
    }
    chunks.push(Buffer.from(chunk))
  }

  if (!size) throw new Error('ملف الصوت فارغ أو تعذّر تنزيله.')
  return Buffer.concat(chunks, size)
}

const handler = async (m, { conn, text = '' }) => {
  const effectName = text.trim().toLocaleLowerCase().replace(/[\u064B-\u065F\u0670]/g, '')
  const effect = EFFECTS.get(effectName)
  if (!effect) {
    return m.reply('اختر تأثيرًا: سريع، بطيء، عميق، صدى، أو عكس. مثال: .تأثير صدى (بالرد على صوت).')
  }

  const quotedAudio = m.quoted?.mediaMessage?.audioMessage
  if (!quotedAudio) return m.reply('رد على رسالة صوتية أولًا، ثم أرسل .تأثير مع اسم التأثير.')
  if (Number(quotedAudio.seconds) > 120) return m.reply('الحد الأقصى لمدة الصوت دقيقتان.')
  if (activeConversions >= MAX_ACTIVE_CONVERSIONS) return m.reply('هناك تحويلان صوتيان قيد التنفيذ؛ حاول بعد قليل.')

  activeConversions++
  try {
    await m.reply('⏳ جاري تطبيق التأثير الصوتي...')
    const input = await downloadAudio(quotedAudio)
    const output = await applyAudioEffect(input, effect)
    await conn.sendMessage(m.chat, {
      audio: output,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true,
    }, { quoted: m })
  } catch (error) {
    console.error('[AUDIO EFFECT]', error?.message || error)
    await m.reply(`❌ ${error?.message || 'تعذر تحويل الصوت.'}`)
  } finally {
    activeConversions--
  }
}

handler.help = ['تأثير <سريع|بطيء|عميق|صدى|عكس> (بالرد على صوت)']
handler.tags = ['media']
handler.command = /^(تأثير|مؤثر)$/i
handler.limit = 1

export default handler
