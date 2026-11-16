/*
 * FLONA BOT — القائمة الرئيسية
 * هذه القائمة مخصصة لمشروع FLONA BOT.
 */

import moment from "moment-timezone"
import { prepareWAMessageMedia, generateWAMessageFromContent } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { MENU_SECTIONS, getMenuCategories, getMenuCommands, normalizeMenuSection } from '../lib/menu-categories.js'

const VIDEO_URL = 'https://files.catbox.moe/9n2xcd.mp4'
const BRAND_NAME = global.botName || '𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓'
const BRAND_DEV = global.botDev || '𝐅𝐋𝐎𝐍𝐀'
const MENU_DIR = path.join(process.cwd(), 'src', 'menu')
const MENU_FILE = path.join(MENU_DIR, 'menu.mp4')

async function ensureMenuVideo() {
  if (!fs.existsSync(MENU_DIR)) {
    fs.mkdirSync(MENU_DIR, { recursive: true })
  }
  if (!fs.existsSync(MENU_FILE)) {
    const res = await axios.get(VIDEO_URL, { responseType: 'arraybuffer' })
    fs.writeFileSync(MENU_FILE, Buffer.from(res.data))
  }
  return fs.readFileSync(MENU_FILE)
}

function getActiveTags() {
  return getMenuCategories(global.plugins || {})
}

function getCategoryRows(tags, usedPrefix = '.') {
  return tags.map(tag => {
    const section = MENU_SECTIONS[tag]
    return {
      title: `${section.icon} ${section.title}`,
      description: `عرض أوامر ${section.title}`,
      id: `${usedPrefix}menu ${tag}`
    }
  })
}

function getCommandsByTag(tag, usedPrefix = '.') {
  const icon = MENU_SECTIONS[tag]?.icon || '⚘'
  return getMenuCommands(global.plugins || {}, tag)
    .map(command => `${icon} *${usedPrefix}${command}*`)
}

function decorateCategoryHeader(tag, cmdCount) {
  const { icon, title } = MENU_SECTIONS[tag]
  return `╭━━━━━━━━━━━━━━━━━━━╮
┃ ${icon} ${title} ${icon} ┃
╰━━━━━━━━━━━━━━━━━━━╯
⚘ *الأوامر المتاحة:* ${cmdCount} ⚘`
}

async function sendCategoryMenu(m, conn, tag, usedPrefix = '.') {
  const cmds = getCommandsByTag(tag, usedPrefix)
  const header = decorateCategoryHeader(tag, cmds.length)
  const txt = cmds.length === 0
    ? '⚠️ لا توجد أوامر في هذا القسم حالياً'
    : `${header}\n\n${cmds.join('\n')}`

  try {
    const videoBuffer = await ensureMenuVideo()
    const mediaMessage = await prepareWAMessageMedia(
      { video: videoBuffer, gifPlayback: true },
      { upload: conn.waUploadToServer }
    )

    const allTags = getActiveTags()
    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            header: { hasMediaAttachment: true, videoMessage: mediaMessage.videoMessage },
            body: { text: txt },
            footer: { text: BRAND_NAME },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "single_select",
                  buttonParamsJson: JSON.stringify({
                    title: "📂 اختر قسم آخر",
                    sections: [{ title: '📂 أقسام البوت', rows: getCategoryRows(allTags, usedPrefix) }]
                  })
                },
                {
                  name: "quick_reply",
                  buttonParamsJson: JSON.stringify({
                    display_text: "🔙 رجوع للرئيسية",
                    id: `${usedPrefix}menu`
                  })
                }
              ],
              messageParamsJson: JSON.stringify({
                bottom_sheet: { in_thread_buttons_limit: 1 }
              })
            }
          }
        }
      }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, {})
  } catch (e) {
    await conn.sendMessage(m.chat, { text: txt }, { quoted: m })
  }
}

let handler = async (m, { conn, usedPrefix, args }) => {
  try {
    const tag = normalizeMenuSection(args[0]?.trim())
    if (tag && MENU_SECTIONS[tag]) {
      return await sendCategoryMenu(m, conn, tag, usedPrefix)
    }

    let uptimeSec = process.uptime()
    let uptimeStr = `${Math.floor(uptimeSec/3600)}h ${Math.floor((uptimeSec%3600)/60)}m ${Math.floor(uptimeSec%60)}s`
    const now     = moment().tz("Africa/Cairo")
    const timeStr = now.format("hh:mm:ss A")
    const tagUser = '@' + m.sender.split('@')[0]
    const line    = "━━━━━━━━━━━━━━━━━━━━━━"

    const allTags = getActiveTags()
    const txt = `
╭━━━━━━━━━━━━━━━━━━━━╮
┃  『 𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓 』  ┃
╰━━━━━━━━━━━━━━━━━━━━╯
أهلاً بك ${tagUser} ✦

👑 المطور: ${BRAND_DEV}
⏱️ التشغيل: ${uptimeStr}
🕒 الوقت: ${timeStr}
📂 الأقسام المتاحة: ${allTags.length}

اضغط زر «📂 الأقسام» لعرض الأوامر حسب القسم.
كل قسم يعرض أوامره بشكل مستقل لتبقى القائمة مرتبة.
`

    await conn.sendMessage(m.chat, { react: { text: '‍🌓', key: m.key } })

    const videoBuffer = await ensureMenuVideo()
    const mediaMessage = await prepareWAMessageMedia(
      { video: videoBuffer, gifPlayback: true },
      { upload: conn.waUploadToServer }
    )

    const flonaSections = [
      {
        title: BRAND_NAME,
        highlight_label: "⚡ خيارات سريعة",
        rows: [
          { title: "📂 الأقسام", description: "عرض الأوامر حسب القسم", id: `${usedPrefix}menu` },
          { title: "حـالـة الـنـظـام", description: "فحص السرعة والأداء", id: `${usedPrefix}ping` },
          { title: "هوية البوت", description: "معلومات FLONA BOT", id: `${usedPrefix}مطور` }
        ]
      }
    ]

    const sectionsOnly = [
      {
        title: "📂 أقسام البوت",
        rows: getCategoryRows(allTags, usedPrefix)
      }
    ]

    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            header: {
              hasMediaAttachment: true,
              videoMessage: mediaMessage.videoMessage
            },
            body: { text: txt },
            footer: { text: BRAND_NAME },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "single_select",
                  buttonParamsJson: JSON.stringify({
                    title: `${BRAND_NAME} 🌓`,
                    sections: flonaSections
                  })
                },
                {
                  name: "single_select",
                  buttonParamsJson: JSON.stringify({
                    title: "📂 الأقسام",
                    sections: sectionsOnly
                  })
                }
              ],
              messageParamsJson: JSON.stringify({
                limited_time_offer: {
                  text: BRAND_NAME,
                  url: "https://whatsapp.com",
                  copy_code: BRAND_NAME,
                  expiration_time: 1754613436864329
                },
                bottom_sheet: {
                  in_thread_buttons_limit: 1,
                  divider_indices: [1],
                  list_title: BRAND_NAME,
                  button_title: "فتح قائمة FLONA"
                },
                tap_target_configuration: {
                  title: `${BRAND_NAME} ◂`,
                  description: "القائمة الرئيسية",
                  canonical_url: "https://whatsapp.com",
                  domain: "https://whatsapp.com",
                  button_index: 0
                }
              })
            },
            contextInfo: {
              mentionedJid: [m.sender],
              isForwarded: true,
              forwardingSlib: 999999
            }
          }
        }
      }
    }, { quoted: m })

    await conn.relayMessage(m.chat, msg.message, {})

  } catch (e) {
    console.error(e)
    conn.reply(m.chat, "❌ حصل خطأ أثناء تشغيل القائمة", m)
  }
}

handler.command = [
  'menu','help','allmenu',
  'الاوامر','اوامر','اومرو','امور','أوامر',
  'القائمه','القائمة'
]

handler.help = ['اوامر']
handler.tags = ['main']

export default handler
