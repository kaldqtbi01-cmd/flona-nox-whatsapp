// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  FLONA BOT — نقطة التشغيل الرئيسية
//  الاتصال بواتساب يُدار بالكامل من ./whatsapp.js
//  هذا الملف يربط الاتصال بنظام الأوامر (handler.js + plugins) وبقية الأنظمة.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1'
process.env.UV_THREADPOOL_SIZE = 8

import cfonts from "cfonts"
import chalk from "chalk"
import path, { join } from "path"
import fs, { readdirSync, unlinkSync, existsSync, watch } from "fs"
import yargs from "yargs"
import { spawn } from "child_process"
import syntaxerror from "syntax-error"
import { fileURLToPath, pathToFileURL } from "url"
import { createRequire } from "module"
import { platform } from "process"
import { format } from "util"
import { Low, JSONFile } from "lowdb"
import { sanitizeError } from "../lib/safe-error.js"
import { initFeatureStore } from "../lib/feature-store.js"
import { createAIProviders } from "../lib/ai-providers.js"
import { createAICore } from "../lib/ai-core.js"
import { createAgentEngine } from "../lib/agent-memory.js"
import { createUltimateEngines } from "../lib/ultimate-engines.js"
import { createSecurityCenter, createAutomationControl, createSystemHealth } from "../lib/security-automation.js"
import { createNexusCore } from "../lib/nexus-core.js"
import { createAutonomousOS } from "../lib/nexus-os.js"

import { startWhatsApp, ROOT_DIR, AUTH_DIR_NAME } from "./whatsapp.js"
import { handleGroupParticipantsUpdate } from "../lib/group-greetings.js"

// كل المسارات النسبية في البوت والإضافات (./tmp, ./media, database.json ...) تبدأ من جذر المشروع
process.chdir(ROOT_DIR)
await import("../config.js")
global.aiProviders = createAIProviders()
global.aiCore = createAICore({ providers: global.aiProviders })

const { makeWASocket: MakeSocket, protoType, serialize } = await import("../lib/simple.js")
const { default: store } = await import("../lib/store.js")

let lastRequestTime = {}
const MIN_DELAY = 3000

async function waitForRateLimit(key = 'default') {
    return new Promise((resolve) => {
        const now = Date.now()
        const last = lastRequestTime[key] || 0
        const elapsed = now - last
        if (elapsed < MIN_DELAY) {
            setTimeout(resolve, MIN_DELAY - elapsed)
        } else {
            resolve()
        }
        lastRequestTime[key] = Date.now()
    })
}

function clearTmp() {
    const tmpDir = join(__dirname, 'tmp')
    if (!existsSync(tmpDir)) return
    readdirSync(tmpDir).forEach(file => {
        try { unlinkSync(join(tmpDir, file)) } catch {}
    })
}

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== "win32") {
    return rmPrefix ? (/file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL) : pathToFileURL(pathURL).toString()
}
global.__dirname = function dirname(pathURL) {
    return path.dirname(global.__filename(pathURL, true))
}
global.__require = function require(dir = import.meta.url) {
    return createRequire(dir)
}

global.timestamp = { start: new Date() }
const __dirname = ROOT_DIR
global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())
global.prefix = new RegExp("^[#!./-]")

// مجلد الجلسة الثابت (تستخدمه إضافات النسخ الاحتياطي لاستثنائه)
global.sessions = AUTH_DIR_NAME

// ألوان FLONA BOT - بنفسجي/أزرق
const cheonBlue    = chalk.hex("#5B8DEF")
const cheonPurple  = chalk.hex("#9B59B6")
const cheonCyan    = chalk.hex("#00BCD4")
const cheonRed     = chalk.hex("#E74C3C")
const cheonGold    = chalk.hex("#F1C40F")
const cheonGray    = chalk.hex("#7F8C8D")
const cheonGreen   = chalk.hex("#2ECC71")

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

async function showCheonBanner() {
    console.clear()
    console.log(cheonPurple("".repeat(60)))
    cfonts.say("", { font: "block", align: "center", gradient: ["#5B8DEF", "#9B59B6"] })
    cfonts.say("", { font: "console", align: "center", colors: ["#00BCD4"] })
    console.log(cheonPurple("『 𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓 』"))
    console.log(cheonPurple("".repeat(60)))
}

await showCheonBanner()
protoType()
serialize()

// ━━━ قاعدة البيانات ━━━
global.db = new Low(new JSONFile(join(ROOT_DIR, "database.json")))
await global.db.read()
global.db.data = {
    users: {},
    chats: {},
    stats: {},
    settings: {},
    ...(global.db.data || {}),
}
global.featureStore = initFeatureStore(global.db)
global.agentEngine = createAgentEngine({ core: global.aiCore, store: global.featureStore })
global.ultimateEngines = createUltimateEngines({ core: global.aiCore, store: global.featureStore })
global.securityCenter = createSecurityCenter({ store: global.featureStore })
global.automationControl = createAutomationControl({ core: global.aiCore, store: global.featureStore })
global.systemHealth = createSystemHealth({ providers: global.aiProviders, core: global.aiCore, engines: global.ultimateEngines })
global.nexusCore = createNexusCore({ core: global.aiCore, store: global.featureStore, security: global.securityCenter })
global.nexusOS = createAutonomousOS({ core: global.aiCore, store: global.featureStore, nexus: global.nexusCore, security: global.securityCenter })

global.loadDatabase = async function() {
    if (global.db.data) return
    await global.db.read()
    global.db.data = {
        users: {},
        chats: {},
        stats: {},
        settings: {},
        ...(global.db.data || {}),
    }
}

setInterval(async () => {
    if (global.db.data) await global.db.write()
}, 60 * 1000)

global.sendFromChannel = async function(jid, content, channelId = global.ch.main) {
    try {
        const msgContent = typeof content === 'string'
            ? { text: content }
            : content

        const withContext = {
            ...msgContent,
            contextInfo: {
                ...(msgContent.contextInfo || {}),
                forwardingScore: 1,
                isForwarded: false,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: channelId,
                    newsletterName: global.botName,
                    serverMessageId: -1,
                }
            }
        }
        return await global.conn.sendMessage(jid, withContext)
    } catch (e) {
        return await global.conn.sendMessage(jid, typeof content === 'string' ? { text: content } : content)
    }
}

// ━━━ الإضافات (plugins) ━━━
const pluginFolder = join(ROOT_DIR, "plugins")
const pluginFilter = (filename) => /\.js$/.test(filename)
global.plugins = {}

async function filesInit() {
    const files = readdirSync(pluginFolder).filter(pluginFilter).sort((a, b) => {
        // القائمة الرئيسية يجب أن تفوز بالأسماء العامة مثل menu/help،
        // قبل إضافات الألعاب التي تستخدم help كمساعدة داخلية.
        if (a === "main-menu.js") return -1
        if (b === "main-menu.js") return 1
        return a.localeCompare(b, "ar")
    })
    await Promise.allSettled(files.map(async (filename) => {
        try {
            const file = global.__filename(join(pluginFolder, filename))
            const module = await import(file)
            global.plugins[filename] = module.default || module
        } catch (e) {
            console.error(`[plugin] ${filename}: ${sanitizeError(e)}`)
            delete global.plugins[filename]
        }
    }))
}

await filesInit()
console.log(cheonCyan(`  🪻 ${Object.keys(global.plugins).length} بلوجين تم تحميلها`))

const reloadDebounce = {}
global.reload = async (_ev, filename) => {
    if (!pluginFilter(filename)) return
    if (reloadDebounce[filename]) clearTimeout(reloadDebounce[filename])
    reloadDebounce[filename] = setTimeout(async () => {
        delete reloadDebounce[filename]
        const dir = join(pluginFolder, filename)
        if (filename in global.plugins && !existsSync(dir)) {
            delete global.plugins[filename]
            return
        }
        const err = syntaxerror(fs.readFileSync(dir), filename, {
            sourceType: "module",
            allowAwaitOutsideFunction: true,
        })
        if (err) {
            console.error(`❌ '${filename}'\n${format(err)}`)
            return
        }
        try {
            const module = await import(`${global.__filename(dir)}?update=${Date.now()}`)
            global.plugins[filename] = module.default || module
            console.log(cheonGray(`  🔄 تم إعادة تحميل: ${filename}`))
        } catch (e) {
            console.error(`❌ '${filename}'\n${sanitizeError(e)}`)
        }
    }, 500)
}

watch(pluginFolder, global.reload)

// ━━━ ربط نظام الأوامر (handler.js) بالاتصال الحالي ━━━
const handlerUrl = pathToFileURL(join(ROOT_DIR, "handler.js")).href
let handler = await import(handlerUrl)

/** يربط مستمعي نظام الأوامر بالسوكت الحالي (يُستدعى مع كل سوكت جديد أو عند إعادة تحميل handler.js) */
function bindHandlers(sock) {
    if (!sock) return
    if (sock.handler) sock.ev.off("messages.upsert", sock.handler)
    if (sock.statusHandler) sock.ev.off("messages.upsert", sock.statusHandler)
    if (sock.groupGreetingHandler) sock.ev.off("group-participants.update", sock.groupGreetingHandler)
    sock.handler = handler.handler.bind(sock)
    sock.groupGreetingHandler = (update) => {
        handleGroupParticipantsUpdate(sock, update).catch((error) =>
            console.error('[Group greeting] Event handler failed:', error?.message || error))
    }
    sock.statusHandler = async (update) => {
        try {
            const settings = global.db?.data?.settings?.[sock.user?.jid] || {}
            if (!settings.autoStatus) return
            for (const message of update?.messages || []) {
                if (message?.key?.remoteJid !== "status@broadcast") continue
                await sock.readMessages([message.key]).catch(() => {})
                if (settings.autoStatusReact) {
                    await sock.sendMessage("status@broadcast", {
                        react: { text: "💚", key: message.key },
                        statusJidList: [message.key.participant || message.key.remoteJid]
                    }).catch(() => {})
                }
            }
        } catch {}
    }
    // الرسائل الخاصة والمجموعات تمر كلها عبر نفس المعالج (m.isGroup يحدد النوع)
    sock.ev.on("messages.upsert", sock.handler)
    sock.ev.on("group-participants.update", sock.groupGreetingHandler)
    sock.ev.on("messages.upsert", sock.statusHandler)
}

global._lastMsgTime = Date.now()
let channelsJoined = false

async function joinChannels(sock) {
    if (!global.ch) return
    const channels = Object.values(global.ch).filter(v => typeof v === "string" && v.endsWith("@newsletter"))
    for (const channelId of channels) {
        try {
            await sock.newsletterFollow(channelId)
            console.log(cheonGreen(`تم: ${channelId.split("@")[0]}`))
        } catch (e) {
            console.log(cheonGray(`  ℹ️  القناة ${channelId.split("@")[0]}: ${e.message}`))
        }
        await sleep(1000)
    }
}

console.info = () => {}

// ━━━ طريقة الاقتران: من سطر الأوامر أو متغيرات البيئة فقط (لا أرقام داخل الكود) ━━━
const argv = process.argv.slice(2)
const loginMethod =
    argv.includes("code") ? "code" :
    argv.includes("qr")   ? "qr"   :
    (["qr", "code"].includes((process.env.WA_LOGIN_METHOD || "").toLowerCase())
        ? process.env.WA_LOGIN_METHOD.toLowerCase() : undefined)

const whatsapp = await startWhatsApp({
    method: loginMethod,
    phoneNumber: process.env.WA_PHONE_NUMBER || global.opts.phone || global.botNumber || undefined,
    relink: argv.includes("relink"),
    // نفس غلاف lib/simple.js السابق (يضيف دوال conn.reply وغيرها) مع الحفاظ على الدردشات المخزنة
    makeSocket: (config) => MakeSocket(config, { chats: global.conn?.chats || {} }),
    getMessage: async (key) => {
        try { return await store.loadMessage(key.remoteJid, key.id) } catch { return undefined }
    },
    log: {
        info:  (t) => console.log(cheonCyan(`  ${t}`)),
        warn:  (t) => console.log(cheonGold(`  ${t}`)),
        error: (t) => console.log(cheonRed(`  ${t}`)),
        qr:    (t) => console.log(cheonPurple(t)),
    },
})
global.whatsapp = whatsapp

whatsapp.on("socket", (sock) => {
    global.conn = sock
    sock.isInit = false
    bindHandlers(sock)
    sock.ev.on("messages.upsert", () => { global._lastMsgTime = Date.now() })
})
// أول سوكت أُنشئ قبل تسجيل المستمع أعلاه
if (whatsapp.sock) whatsapp.emit("socket", whatsapp.sock)

whatsapp.on("state", (state) => {
    global.stopped = state === "open" ? "open" : state === "connecting" ? "connecting" : "close"
})
global.stopped = whatsapp.isOpen ? "open" : "close"

whatsapp.on("new-login", () => { if (global.conn) global.conn.isInit = true })

whatsapp.on("open", async (sock) => {
    if (!channelsJoined) {
        channelsJoined = true
        await joinChannels(sock).catch(() => {})
    }
    console.log(cheonPurple("𝑻𝒉𝒆 𝒃𝒐𝒕 𝒊𝒔 𝒕𝒖𝒓𝐧𝐞𝐝 𝐨𝐧"))
    // إعادة تشغيل جلسات .تنصيب المحفوظة بعد إقلاع البوت الأساسي.
    // المجلدات لا تُحذف؛ يتم فقط إعادة فتح الاتصالات الموجودة على القرص.
    setTimeout(async () => {
        try {
            const { checkSubBots } = await import("../plugins/jadbots.js")
            await checkSubBots()
        } catch (e) {
            console.error(`❌ تعذر إعادة تشغيل جلسات البوتات الفرعية: ${sanitizeError(e)}`)
        }
    }, 5000)
})

/**
 * متوافقة مع الاستخدام السابق في الإضافات:
 *  reloadHandler()     ← إعادة تحميل handler.js وربطه بالاتصال الحالي
 *  reloadHandler(true) ← إعادة تشغيل اتصال واتساب (بدون حذف الجلسة)
 */
global.reloadHandler = async function (restartConn) {
    try {
        const Handler = await import(`${handlerUrl}?update=${Date.now()}`)
        if (Object.keys(Handler || {}).length) handler = Handler
    } catch (e) { console.error(`[reloadHandler] ${sanitizeError(e)}`) }

    if (restartConn) {
        await whatsapp.restart("reloadHandler")
        return true
    }
    bindHandlers(global.conn)
    return true
}

// ━━━ أدوات النظام ━━━
async function _quickTest() {
    const test = await Promise.all([
        spawn("ffmpeg"), spawn("ffprobe"),
        spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-filter_complex", "color", "-frames:v", "1", "-f", "webp", "-"]),
        spawn("convert"), spawn("magick"), spawn("gm"), spawn("find", ["--version"]),
    ].map((p) => Promise.race([
        new Promise((r) => p.on("close", (c) => r(c !== 127))),
        new Promise((r) => p.on("error", () => r(false))),
    ])))
    const [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = test
    global.support = Object.freeze({ ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find })
    console.log(cheonGray(`  📦 ffmpeg:${ffmpeg ? "✅" : "❌"} | ffprobe:${ffprobe ? "✅" : "❌"}`))
}
_quickTest()

const tmpDir = join(__dirname, "tmp")
if (!existsSync(tmpDir)) fs.mkdirSync(tmpDir)

setInterval(async () => {
    if (!whatsapp.isOpen) return
    clearTmp()
    console.log(cheonGray(`  🗑️  تنظيف مجلد tmp`))
}, 1000 * 60 * 4)

// ملاحظة: تم إيقاف التنظيف الدوري لملفات الجلسة (pre-key / sender-key / session-*)
// لأن حذفها يفسد فك تشفير الرسائل ويُجبر على إعادة الاقتران. Baileys تدير هذه الملفات بنفسها.

// ━━━ Watchdog: يتحقق من الاتصال بعد صمت طويل ━━━
setInterval(async () => {
    if (!whatsapp.isOpen || !global.conn?.user) return

    const silent = Date.now() - global._lastMsgTime
    const TEN_MIN = 10 * 60 * 1000

    if (silent > TEN_MIN) {
        console.log(cheonCyan(`  🪻 Watchdog: ${Math.floor(silent / 60000)} دقيقة صمت — أتحقق...`))
        try {
            await waitForRateLimit('presence')
            await global.conn.sendPresenceUpdate("available").catch(() => {})
            await sleep(3000)

            const wsOpen = global.conn?.ws?.isOpen ?? (global.conn?.ws?.readyState === 1)
            global._lastMsgTime = Date.now()
            if (!wsOpen) {
                console.log(cheonRed(` Watchdog: الاتصال منقطع — إعادة ربط`))
                await whatsapp.restart("watchdog")
            } else {
                console.log(cheonGray(`Watchdog: الاتصال شغّال، البوت صامت بس`))
            }
        } catch (e) {
            console.error(`Watchdog error: ${sanitizeError(e)}`)
        }
    }
}, 5 * 60 * 1000)

process.on("uncaughtException", (err) => console.error(cheonRed("  ⚠️  " + sanitizeError(err))))
process.on("unhandledRejection", (reason) => console.error(cheonRed("  ⚠️  " + sanitizeError(reason))))

console.log(cheonGreen("\n  ✅ 𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓 شغّال! 🪻\n"))
