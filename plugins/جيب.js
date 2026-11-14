/* 🪻 FLONA BOT — قارئ ملفات المطور */

import fs from 'fs'
import path from 'path'

let handler = async (m, { text, usedPrefix, command, isOwner, isROwner }) => {
  if (!isOwner && !isROwner) {
    return m.reply(`🚫 هذا الأمر خاص بالمطور فقط`)
  }

  if (!text) {
    return m.reply(`
╭━━━❖ 『 𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓 』 ❖━━━╮
┃ ⚡ أوامر الجلب
┃
┃ ✦ ${usedPrefix + command} .
┃ ✦ ${usedPrefix + command} plugins
┃ ✦ ${usedPrefix + command} settings.js
┃
╰━━━❖  مطور FLONA ❖━━━╯
`)
  }

  const root = path.resolve(process.cwd())
  const targetPath = path.resolve(root, text)
  if (targetPath !== root && !targetPath.startsWith(root + path.sep)) {
    return m.reply('❌ لا يمكن قراءة مسار خارج مجلد المشروع.')
  }

  try {

    if (!fs.existsSync(targetPath)) {
      return m.reply(`❌ الملف أو المسار غير موجود`)
    }

    if (fs.lstatSync(targetPath).isDirectory()) {

      const files = fs.readdirSync(targetPath)

      let teks = `
╭━━━❖ 📁 𝐅𝐋𝐎𝐍𝐀 𝐅𝐈𝐋𝐄 𝐌𝐀𝐍𝐀𝐆𝐄𝐑 ❖━━━╮

`

      files.forEach((f, i) => {
        teks += `┃ ${i + 1}. 📄 ${f}\n`
      })

      teks += `
╰━━━❖ ⚡ ${files.length} 𝑭𝒊𝒍𝒆𝒔 ❖━━━╯`

      return m.reply(teks)
    }

    if (fs.lstatSync(targetPath).isFile()) {

      let content = fs.readFileSync(targetPath, 'utf-8')

      if (content.length > 4000) {
        return m.reply(`⚠️ الملف كبير جدًا لا يمكن عرضه`)
      }

      return m.reply(`
╭━━━❖ 📄 𝐅𝐋𝐎𝐍𝐀 𝐑𝐄𝐀𝐃𝐄𝐑 ❖━━━╮

${content}

╰━━━❖ 🩸 ${text} ❖━━━╯
`)
    }

  } catch (e) {
    return m.reply(`❌ خطأ:\n${e.message}`)
  }
}

handler.help = ['جيب']
handler.tags = ['owner']
handler.command = /^(جيب|read|get)$/i
handler.owner = true

export default handler
