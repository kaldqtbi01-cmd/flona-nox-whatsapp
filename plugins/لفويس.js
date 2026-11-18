/*
⌁ 𝐍𝐎𝐗 ⌁
𝚆𝙸𝙻𝙻𝙸𝙰𝙼 𝚇 𝚂𝙷𝙰𝙽𝙺𝚂

「 𝐂𝐫𝐞𝐝𝐢𝐭𝐬 𝐛𝐲 𝚆𝙸𝙻𝙻𝙸𝙰𝙼 𝚇 𝚂𝙷𝙰𝙽𝙺𝚂 」
「 لا تحذف الحقوق 🖤 」
𝐍𝐎𝐗 channel
https://whatsapp.com/channel/0029VbCeOCi7tkjC9bGs3U0l
𝙎𝙃𝘼𝙉𝙆𝙎 channel
https://whatsapp.com/channel/0029VbC5LLx6GcGDXZUmHP0y
 📜 𝙏𝙝𝙞𝙨 𝙞𝙨 𝙩𝙝𝙚 𝙍𝙀𝙋𝙊 𝙡𝙞𝙣𝙠 𝙬𝙞𝙩𝙝 𝙖𝙡𝙡 𝙩𝙝𝙚 𝙘𝙤𝙙𝙚𝙨:
⚡ https://github.com/SHANKS-CODE-1/CODE
*/

import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { getFfmpegPath } from '../lib/atlas-local-converters.js'

const execFileAsync = promisify(execFile)

let handler = async (m, { conn }) => {
    let q = m.quoted
    if (!q) return m.reply('⚡ رد على فيديو أو صوت لتحويله لفويس')

    let mime = (q.msg || q).mimetype || ''
    let isVideo = mime.includes('video')
    let isAudio = mime.includes('audio')

    if (!isVideo && !isAudio) {
        return m.reply('⚡ رد على فيديو أو صوت فقط')
    }

    await conn.sendMessage(m.chat, { react: { text: '🎤', key: m.key } })
    await m.reply('⏳ جاري تحويل الملف لفويس بجودة عالية...')

    let inputPath = ''
    let outputPath = ''
    try {
        let media = await q.download()
        let ext = isVideo ? 'mp4' : (mime.includes('ogg') ? 'ogg' : 'mp3')
        const ffmpegPath = await getFfmpegPath()
        inputPath = join(tmpdir(), `flona_voice_in_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`)
        outputPath = join(tmpdir(), `flona_voice_out_${Date.now()}_${Math.random().toString(36).slice(2)}.ogg`)

        writeFileSync(inputPath, media)

        await execFileAsync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', inputPath, '-t', '300', '-c:a', 'libopus', '-b:a', '64k', '-ac', '2', '-ar', '48000', '-vbr', 'on', '-compression_level', '0', '-application', 'audio', '-frame_duration', '20', '-f', 'opus', outputPath], { timeout: 60000 })

        if (!existsSync(outputPath)) throw new Error('فشل التحويل')

        let buffer = readFileSync(outputPath)

        
        if (buffer.length > 1024 * 1024) {
            let midPath = join(tmpdir(), `flona_voice_mid_${Date.now()}_${Math.random().toString(36).slice(2)}.ogg`)
            await execFileAsync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', inputPath, '-t', '300', '-c:a', 'libopus', '-b:a', '32k', '-ac', '1', '-ar', '24000', '-vbr', 'on', '-compression_level', '3', '-application', 'audio', '-frame_duration', '40', '-f', 'opus', midPath], { timeout: 60000 })

            if (existsSync(midPath)) {
                buffer = readFileSync(midPath)
                try { unlinkSync(midPath) } catch {}
            }
        }

        
        await conn.sendMessage(m.chat, {
            audio: buffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
        }, { quoted: m })

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })

        
    } catch (e) {
        console.error(e)
        await m.reply('❌ فشل التحويل\n⚡ تأكد من تثبيت ffmpeg')
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } })
    } finally {
        try { if (inputPath && existsSync(inputPath)) unlinkSync(inputPath) } catch {}
        try { if (outputPath && existsSync(outputPath)) unlinkSync(outputPath) } catch {}
    }
}

handler.help = ['لفويس']
handler.tags = ['tools']
handler.command = /^(لفويس|tovoice|opus|تحويل_فويس)$/i

export default handler
