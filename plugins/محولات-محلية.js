import {
  audioOrVideoToMp3,
  getFfmpegPath,
  imageToPdf,
  imageToPng,
  textToQrPng,
} from '../lib/atlas-local-converters.js'

const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
  'video/quicktime': 'mov',
}

function mimeOf(quoted) {
  return String(quoted?.mimetype || quoted?.msg?.mimetype || '').split(';')[0].trim().toLowerCase()
}

async function downloadQuoted(quoted) {
  if (typeof quoted?.download !== 'function') throw new Error('رد على الوسيط المراد تحويله أولًا')
  const buffer = await quoted.download()
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('تعذر تنزيل الوسيط المقتبس')
  return buffer
}

async function react(conn, m, text) {
  try { await conn.sendMessage(m.chat, { react: { text, key: m.key } }) } catch {}
}

const handler = async (m, { conn, text = '', command = '' }) => {
  const cmd = String(command).toLowerCase()
  const reply = message => m.reply(message)

  try {
    await react(conn, m, '⏳')

    if (cmd === 'toqr' || cmd === 'qr' || cmd === 'رمز') {
      const image = await textToQrPng(text)
      await conn.sendMessage(m.chat, {
        image,
        caption: 'تم إنشاء رمز QR محليًا.',
      }, { quoted: m })
      await react(conn, m, '✅')
      return
    }

    const quoted = m.quoted
    if (!quoted) throw new Error('رد على صورة أو ملصق أو ملف صوت/فيديو، ثم أرسل الأمر.')
    const mime = mimeOf(quoted)
    const input = await downloadQuoted(quoted)

    if (cmd === 'toimg' || cmd === 'toimage' || cmd === 'تحويل_صورة') {
      if (mime !== 'image/webp') throw new Error('هذا الأمر يحوّل ملصق WebP ثابتًا إلى PNG؛ رد على ملصق WebP ثابت.')
      const image = await imageToPng(input, 'webp', { ffmpegPath: await getFfmpegPath() })
      await conn.sendMessage(m.chat, { image, caption: 'تم تحويل WebP إلى PNG محليًا.' }, { quoted: m })
      await react(conn, m, '✅')
      return
    }

    if (cmd === 'tomp3' || cmd === 'toaudio') {
      if (!mime.startsWith('audio/') && !mime.startsWith('video/')) {
        throw new Error('رد على ملف صوت أو فيديو مدعوم، ثم أرسل الأمر.')
      }
      const ext = MIME_EXTENSIONS[mime]
      if (!ext) throw new Error(`صيغة ${mime} غير مدعومة محليًا.`)
      const audio = await audioOrVideoToMp3(input, ext, { ffmpegPath: await getFfmpegPath() })
      if (cmd === 'toaudio') {
        await conn.sendMessage(m.chat, { audio, mimetype: 'audio/mpeg' }, { quoted: m })
      } else {
        await conn.sendMessage(m.chat, {
          document: audio,
          mimetype: 'audio/mpeg',
          fileName: 'flona-converted.mp3',
        }, { quoted: m })
      }
      await react(conn, m, '✅')
      return
    }

    if (cmd === 'topdf' || cmd === 'imgtopdf' || cmd === 'تحويل_pdf') {
      if (!mime.startsWith('image/')) throw new Error('رد على صورة، ثم أرسل .topdf')
      const ext = MIME_EXTENSIONS[mime]
      if (!ext) throw new Error(`صيغة الصورة ${mime} غير مدعومة محليًا.`)
      const png = await imageToPng(input, ext, { ffmpegPath: await getFfmpegPath() })
      const pdf = await imageToPdf(png)
      await conn.sendMessage(m.chat, {
        document: pdf,
        mimetype: 'application/pdf',
        fileName: 'flona-image.pdf',
      }, { quoted: m })
      await react(conn, m, '✅')
      return
    }

  throw new Error('الأمر غير معروف. الأوامر المدعومة: .toqr، .toimg، .tomp3، .toaudio، .topdf')
  } catch (error) {
    console.error('[FLONA LOCAL CONVERTER]', error?.message || error)
    await react(conn, m, '❌')
    return reply(`❌ ${error?.message || 'تعذر تنفيذ التحويل المحلي.'}`)
  }
}

handler.help = [
  'toqr <نص أو رابط>',
  'toimg (بالرد على ملصق WebP ثابت)',
  'tomp3 (بالرد على صوت/فيديو)',
  'toaudio (بالرد على صوت/فيديو)',
  'topdf (بالرد على صورة)',
]
handler.tags = ['tools']
handler.command = /^(toqr|qr|رمز|toimg|toimage|تحويل_صورة|tomp3|toaudio|topdf|imgtopdf|تحويل_pdf)$/i

export default handler
