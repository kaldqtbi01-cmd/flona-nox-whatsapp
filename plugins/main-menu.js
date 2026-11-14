/*
 * FLONA BOT — القائمة الرئيسية
 * هذه القائمة مخصصة لمشروع FLONA BOT.
 */

import moment from "moment-timezone"
import { prepareWAMessageMedia, generateWAMessageFromContent } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'
import axios from 'axios'

const VIDEO_URL = 'https://files.catbox.moe/9n2xcd.mp4'
const BRAND_NAME = global.botName || '𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓'
const BRAND_DEV = global.botDev || '𝐅𝐋𝐎𝐍𝐀'
const MENU_DIR = path.join(process.cwd(), 'src', 'menu')
const MENU_FILE = path.join(MENU_DIR, 'menu.mp4')


const categoryNames = {
  'main':         '✨ الرئيسية',
  'owner':        '👑 المطور',
  'ai':           '🤖 الذكاء الاصطناعي',
  'anime':        '🌸 الأنمي والمانجا',
  'economy':      '💰 الاقتصاد',
  'game':         '🎮 الألعاب',
  'group':        '🛡️ إدارة المجموعات',
  'grupo':        '👥 أدوات الجروبات',
  'info':         '📖 المعلومات',
  'internet':     '🌐 الإنترنت',
  'sticker':      '🏷️ الملصقات',
  'tools':        '🧰 الأدوات',
  'download':     '⬇️ التنزيل',
  'downloader':   '📥 التحميل',
  'daily':        '📅 اليوميات',
  'serbot':       '🤖 ربط البوتات',
  'image':        '🖼️ الصور',
  'herramientas': '🔧 الخدمات',
  'nable':        '🔌 التفعيلات',
}

const tagIcons = {
  'main':         '✨',
  'owner':        '👑',
  'ai':           '🤖',
  'anime':        '🌸',
  'economy':      '💰',
  'game':         '🎮',
  'group':        '🛡️',
  'grupo':        '👥',
  'info':         'ℹ️',
  'internet':     '🌐',
  'sticker':      '🏷️',
  'tools':        '🧰',
  'download':     '⬇️',
  'downloader':   '📥',
  'daily':        '📅',
  'serbot':       '🤖',
  'image':        '🖼️',
  'herramientas': '🔧',
  'nable':        '🔌',
}

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
  return [...new Set(
    Object.values(global.plugins || {})
      .filter(p => !p.disabled && p.tags)
      .flatMap(p => Array.isArray(p.tags) ? p.tags : [p.tags])
  )].filter(Boolean)
}

function getCategoryRows(tags, usedPrefix = '.') {
  return tags.map(tag => ({
    title: `${tagIcons[tag] || '📂'} ${categoryNames[tag] || tag}`,
    description: `عرض أوامر ${categoryNames[tag] || tag}`,
    id: `${usedPrefix}menu ${tag}`
  }))
}

function getCommandsByTag(tag) {
  return Object.values(global.plugins || {})
    .filter(p => !p.disabled && p.tags && (Array.isArray(p.tags) ? p.tags : [p.tags]).includes(tag))
    .flatMap(p => (Array.isArray(p.help) ? p.help : [p.help]).filter(Boolean))
    .map(cmd => `${tagIcons[tag] || '⚘'} *.${cmd}*`)
}

function decorateCategoryHeader(catName, cmdCount) {
  const emoji = catName.split(' ')[0]
  return `╭━━━━━━━━━━━━━━━━━━━╮
┃ ${emoji} ${catName} ${emoji} ┃
╰━━━━━━━━━━━━━━━━━━━╯
⚘ *الأوامر المتاحة:* ${cmdCount} ⚘`
}

async function sendCategoryMenu(m, conn, tag, usedPrefix = '.') {
  const cmds = getCommandsByTag(tag)
  const catName = `${tagIcons[tag] || '📂'} ${categoryNames[tag] || tag}`
  const header = decorateCategoryHeader(catName, cmds.length)
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
    const tag = args[0]?.trim().toLowerCase()
    if (tag && categoryNames[tag]) {
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
