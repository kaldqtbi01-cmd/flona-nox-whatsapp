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
import { formatCategoryMenuText, formatMainMenuText, formatUptime } from '../lib/menu-presentation.js'

const VIDEO_URL = 'https://files.catbox.moe/9n2xcd.mp4'
const BRAND_NAME = global.botName || '𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓'
const BRAND_DEV = global.botDev || '𝐅𝐋𝐎𝐍𝐀'
const MENU_DIR = path.join(process.cwd(), 'src', 'menu')
const MENU_FILE = path.join(MENU_DIR, 'flona-menu.mp4')
const MENU_IMAGE_DIR = path.join(process.cwd(), 'media', 'menu-images-720')
const SECTION_IMAGES = Object.freeze({
  main: 'main.png',
  owner: 'owner.png',
  ai: 'ai.png',
  anime: 'anime.png',
  economy: 'economy.png',
  games: 'games.png',
  group: 'group.png',
  download: 'download.png',
  media: 'media.png',
  tools: 'tools.png'
})
const MENU_DEDUPE_WINDOW_MS = 1800
const recentMenuRequests = new Map()

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

async function ensureCategoryImage(tag) {
  const filename = SECTION_IMAGES[tag]
  const file = filename ? path.join(MENU_IMAGE_DIR, filename) : ''
  if (file && fs.existsSync(file)) return fs.readFileSync(file)
  const fallback = path.join(process.cwd(), 'media', 'flona-logo.jpg')
  if (fs.existsSync(fallback)) return fs.readFileSync(fallback)
  throw new Error(`Missing image for menu section: ${tag}`)
}

function isDuplicateMenuRequest(m, tag) {
  const now = Date.now()
  // Native-flow responses can arrive as separate WhatsApp events with
  // different message IDs. Deduplicate by the actual action, not the event ID.
  const key = `${m.chat}:${m.sender}:${tag}`
  const previous = recentMenuRequests.get(key)
  recentMenuRequests.set(key, now)

  for (const [entry, at] of recentMenuRequests) {
    if (now - at > MENU_DEDUPE_WINDOW_MS) recentMenuRequests.delete(entry)
  }

  return Number.isFinite(previous) && now - previous < MENU_DEDUPE_WINDOW_MS
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

async function sendCategoryMenu(m, conn, tag, usedPrefix = '.') {
  const commands = getMenuCommands(global.plugins || {}, tag)
  const txt = formatCategoryMenuText({
    section: MENU_SECTIONS[tag],
    commands,
    usedPrefix
  })

  try {
    const imageBuffer = await ensureCategoryImage(tag)
    const mediaMessage = await prepareWAMessageMedia(
      { image: imageBuffer },
      { upload: conn.waUploadToServer }
    )

    const allTags = getActiveTags()
    const msg = generateWAMessageFromContent(m.chat, {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            header: { hasMediaAttachment: true, imageMessage: mediaMessage.imageMessage },
            body: { text: txt },
            footer: { text: BRAND_NAME },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "single_select",
                  buttonParamsJson: JSON.stringify({
                    title: "🎀 اختاري وجهتك",
                    sections: [{ title: '🌸 أقسام FLONA', rows: getCategoryRows(allTags, usedPrefix) }]
                  })
                },
                {
                  name: "quick_reply",
                  buttonParamsJson: JSON.stringify({
                    display_text: "🌷 العودة لقائمة FLONA",
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
      if (isDuplicateMenuRequest(m, tag)) return
      return await sendCategoryMenu(m, conn, tag, usedPrefix)
    }

    const uptimeStr = formatUptime(process.uptime())
    const now     = moment().tz("Africa/Cairo")
    const timeStr = now.format("hh:mm:ss A")
    const tagUser = '@' + m.sender.split('@')[0]

    const allTags = getActiveTags()
    const txt = formatMainMenuText({
      mention: tagUser,
      developer: BRAND_DEV,
      uptime: uptimeStr,
      time: timeStr,
      sectionCount: allTags.length
    })

    await conn.sendMessage(m.chat, { react: { text: '🦋', key: m.key } })

    const videoBuffer = await ensureMenuVideo()
    const mediaMessage = await prepareWAMessageMedia(
      { video: videoBuffer, gifPlayback: true },
      { upload: conn.waUploadToServer }
    )

    const flonaSections = [
      {
        title: "🎀 FLONA • اختيارات سريعة 🌸",
        highlight_label: "💗 بوابتك إلى فلونا",
        rows: [
          { title: "🌸 استكشفي الأقسام", description: "عالم FLONA مرتب لكِ بعناية", id: `${usedPrefix}menu` },
          { title: "✨ نبض البوت", description: "سرعة واستقرار النظام", id: `${usedPrefix}ping` },
          { title: "👑 حكاية FLONA", description: "هوية البوت ومعلوماته", id: `${usedPrefix}مطور` }
        ]
      }
    ]

    const sectionsOnly = [
      {
        title: "🌷 عوالم FLONA",
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
                    title: "🎀 بوابة FLONA",
                    sections: flonaSections
                  })
                },
                {
                  name: "single_select",
                  buttonParamsJson: JSON.stringify({
                    title: "🌸 استكشفي الأقسام",
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
                  button_title: "افتحي عالم FLONA"
                },
                tap_target_configuration: {
                  title: `🎀 FLONA ${BRAND_NAME} ◂`,
                  description: "بوابتك الجميلة لعالم فلونا",
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
