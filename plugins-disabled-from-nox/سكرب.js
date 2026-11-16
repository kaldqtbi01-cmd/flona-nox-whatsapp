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

import fs from "fs"
import { execFileSync } from "child_process"
import { sanitizeError, publicPluginError } from "../lib/safe-error.js"

let handler = async (m, { conn }) => {
  
  let step = "0 - بداية الأمر"

  try {
    const allowedNumbers = String(process.env.FLONA_BACKUP_ALLOWED_SENDERS || "")
      .split(",")
      .map(number => number.replace(/\D/g, ""))
      .filter(Boolean)
    const senderNumber = String(m.sender || "").replace(/\D/g, "")

    if (!allowedNumbers.length || !allowedNumbers.includes(senderNumber)) {
      return m.reply("❌ انت مش مسموحلك تاخد النسخة الاحتياطية")
    }

    const tempDir = "./tmp"
    const backupName = "NOX-BOT"
    const backupPath = `${tempDir}/${backupName}.zip`
    const password = process.env.FLONA_BACKUP_ARCHIVE_PASSWORD
    const target = String(process.env.FLONA_BACKUP_TARGET || "").trim()
    if (!password || password.length < 12 || !/^\d{5,20}@(s\.whatsapp\.net|g\.us)$/.test(target)) {
      return m.reply("❌ ميزة النسخ الاحتياطي غير مهيأة؛ راجع متغيرات FLONA_BACKUP_* في إعدادات البيئة.")
    }

    
    step = "1 - فحص تثبيت أمر zip"
    try {
      execFileSync("zip", ["-v"], { stdio: "pipe" })
    } catch {
      throw new Error("أمر zip مش متسطب على السيرفر. نزله بـ: apt install zip -y")
    }

    
    step = "2 - تجهيز فولدر tmp وتنضيفه"
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
    for (const file of fs.readdirSync(tempDir)) {
      fs.rmSync(`${tempDir}/${file}`, { recursive: true, force: true })
    }

    await m.reply("📦جاري ارسال النسخه الاحتياطيه")

    
    step = "3 - تحديد الملفات المطلوبة"
    
    const include = [
      "lib",
      "plugins",
      "src",
      "A7A.js",
      "handler.js",
      "index.js",
      "package.json",
      "settings.js",
      "startup.js"
    ]

    const list = include.filter(f => fs.existsSync(f))
    const missing = include.filter(f => !fs.existsSync(f))
    if (missing.length) console.warn("[NOX BACKUP] ملفات مش موجودة وهيتم تخطيها:", missing.join(", "))
    if (list.length === 0) throw new Error("ولا ملف من القائمة موجود في مكان تشغيل البوت")

    step = "4 - إنشاء ملف الزيب (zip)"
    try {
      execFileSync("zip", ["-r", "-q", "-P", password, backupPath, ...list], {
        stdio: "pipe",
        maxBuffer: 1024 * 1024 * 200
      })
    } catch (zipErr) {
      
      
      if (!(zipErr.status === 18 && fs.existsSync(backupPath))) throw zipErr
    }

    
    step = "5 - فحص حجم الملف"
    if (!fs.existsSync(backupPath)) throw new Error("الزيب ما اتعملش أصلاً")
    const sizeMB = fs.statSync(backupPath).size / 1024 / 1024
    if (sizeMB > 95) {
      throw new Error(`حجم النسخة ${sizeMB.toFixed(1)}MB وده أكبر من حد واتساب. استثني فولدرات ميديا/كاش`)
    }

    
    step = "6 - إرسال الملف للجروب"
    const buffer = fs.readFileSync(backupPath)
    const payload = {
      document: buffer,
      fileName: `${backupName}.zip`,
      mimetype: "application/zip"
    }

    let sentTo = null
    try {
      await conn.sendMessage(target, payload, { quoted: m })
      sentTo = "الجروب"
    } catch (sendErr) {
      console.error("[NOX BACKUP] فشل الإرسال للجروب:", sanitizeError(sendErr))
      
      step = "6 - إرسال الملف (بديل: الشات الحالي/الخاص)"
      const fallback = m.chat
      await conn.sendMessage(fallback, payload, { quoted: m })
      sentTo = "الشات الحالي بعد تعذر الإرسال للمستلم المهيأ"
    }

    if (sentTo !== "الجروب") await m.reply("⚠️ أُرسلت النسخة في الشات الحالي بعد تعذر الإرسال للمستلم المهيأ.")

    
    step = "7 - حذف الملف المؤقت"
    fs.unlinkSync(backupPath)

    if (m.chat !== m.sender) return m.reply("ف جروبنا يا مطوري المظ🫦")

  } catch (e) {
    console.error(`[NOX BACKUP] فشل في الخطوة: ${step}`, sanitizeError(e))
    m.reply(publicPluginError(e))
  }
}

handler.help = ["سكرب"]
handler.tags = ["owner"]
handler.command = /^(سكرب|scrb)$/i

export default handler
