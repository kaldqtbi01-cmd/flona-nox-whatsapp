import { spawn } from 'node:child_process'
import { updateYtDlp, getYtDlpPath } from '../lib/yt-dlp.js'

function runVersion(binary) {
  return new Promise((resolve, reject) => {
    const proc = spawn(binary, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    let error = ''
    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL') } catch {}
      reject(new Error('انتهت مهلة التحقق من yt-dlp'))
    }, 10_000)
    proc.stdout.on('data', chunk => { output += chunk.toString() })
    proc.stderr.on('data', chunk => { error += chunk.toString() })
    proc.once('error', err => { clearTimeout(timer); reject(err) })
    proc.once('close', code => {
      clearTimeout(timer)
      if (code === 0) resolve(output.trim())
      else reject(new Error(error.trim() || `exit ${code}`))
    })
  })
}

const handler = async (m, { conn }) => {
  const react = async emoji => {
    try { await conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } }) } catch {}
  }
  await react('⏳')
  await m.reply('⏳ *جاري تحديث yt-dlp والتحقق من SHA-256...*')
  try {
    const path = await updateYtDlp()
    const version = await runVersion(path)
    await react('✅')
    await m.reply(`✅ *تم التحديث والتحقق بنجاح!*

📌 النسخة: ${version}
📂 المسار: ${getYtDlpPath()}`)
  } catch (error) {
    await react('❌')
    await m.reply(`❌ *فشل تحديث yt-dlp بأمان:*
${String(error.message || error).slice(0, 500)}`)
  }
}

handler.help = ['تحديث']
handler.tags = ['owner']
handler.command = /^(تحديث|update|تحديث_يوتيوب|updateytdlp)$/i
handler.owner = true

export default handler
