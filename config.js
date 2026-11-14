import fs from "fs"
import path from "path"

// Load local secrets only when present; never overwrite environment-provided values.
for (const file of [".env", ".env.local"]) {
  try {
    const text = fs.readFileSync(path.resolve(file), "utf8")
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^([\"'])(.*)\1$/, "$2")
    }
  } catch {}
}



const config = {

    botName:    "𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓",
    botTag:     "@FLONA",
    botVersion: "2.0.0",
    botDev:     "𝐅𝐋𝐎𝐍𝐀",
    devNumber:  "967711002393",

    // مجلد جلسة واتساب ثابت. الجلسة القديمة في ./sessions تُنسخ إليه تلقائياً أول مرة.
    sessions:   "auth_info_baileys",
    // لا تضع الرقم هنا — استخدم متغير البيئة WA_PHONE_NUMBER في ملف .env
    botNumber:  process.env.WA_PHONE_NUMBER || "",


    owner: [
        "967711002393", // FLONA - المالك الأساسي
            "217420606263492",
            "79315765067924",
            "10609475252280",
    ],

    ownerLid: [],
    prems:    [],
    premsLid: [],

    prefix: /^[°•π÷×¶∆£¢€¥®™✓=|~!?#%^&.]/,

    
    ch: {
        main:    "120363402804601196@newsletter",
        second:  "120363377374711810@newsletter", // خلهم مش هيفيدوك🐦
    },

   
    

    theme: {
        border:    "🪻",
        icon:      "✦",
        separator: "~*『✦▬▬▬✦┇• 🪻 •┇✦▬▬▬✦』*~",
        header:    (title) => `╔═══「 🪻 ${title} 🪻 」═══╗`,
        subHeader: (title) => `┌─「 ✦ ${title} 」`,
        tail:      `╚══════════════════════╝`,
        subTail:   `└──────────────────────`,
        footer:    `〔 𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓 〕`,
        row:       (key, val) => `│ ✦ ${key}: 〘${val}〙`,
        zarfLine:  `~*『✦▬▬▬✦┇• 🪻 •┇✦▬▬▬✦』*~`,
    },

    links: {
        channel: "https://whatsapp.com/channel/0029Vb6kG3s0AgW2lYD8ad1L",
        group:   "/data/data/com.termux/files/home/NAGUMO-BOT/media/flona-logo.jpg",
        support: "https://chat.whatsapp.com/KkuYNJrg3qv1JslwoFOTUt?mode=gi_t",
        github:  "https://github.com/Loydsumer/baileys-speed",
        dev:     "https://wa.me/967711002393",
    },

    images: {
        menu:       "/data/data/com.termux/files/home/NAGUMO-BOT/media/flona-logo.jpg",
        owner:      "/data/data/com.termux/files/home/NAGUMO-BOT/media/flona-logo.jpg",
        group:      "/data/data/com.termux/files/home/NAGUMO-BOT/media/flona-logo.jpg",
        economy:    "/data/data/com.termux/files/home/NAGUMO-BOT/media/flona-logo.jpg",
        games:      "/data/data/com.termux/files/home/NAGUMO-BOT/media/flona-logo.jpg",
        tools:      "/data/data/com.termux/files/home/NAGUMO-BOT/media/flona-logo.jpg",
        info:       "/data/data/com.termux/files/home/NAGUMO-BOT/media/flona-logo.jpg",
        downloader: "/data/data/com.termux/files/home/NAGUMO-BOT/media/flona-logo.jpg",
        ai:         "/data/data/com.termux/files/home/NAGUMO-BOT/media/flona-logo.jpg",
    },

    

    opts: {
        queque:    false,
        restrict:  false,
        noprint:   false,
        autoread:  true,
        autoReact: true,
    },
}


global.botName    = config.botName
global.botTag     = config.botTag
global.botVersion = config.botVersion
global.botDev     = config.botDev
global.devNumber  = config.devNumber
global.sessions   = config.sessions
global.botNumber  = config.botNumber
global.owner      = config.owner
global.ownerLid   = config.ownerLid
global.prems      = config.prems
global.premsLid   = config.premsLid
global.prefix     = config.prefix
global.ch         = config.ch
global.zarf       = config.zarf
global.theme      = config.theme
global.links      = config.links
global.images     = config.images
global.zarf_settings = config.zarf_settings

global.opts = { ...config.opts, ...(global.opts || {}) }

export default config
