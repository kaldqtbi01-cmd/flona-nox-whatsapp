import { useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, getDevice } from '@whiskeysockets/baileys'
import qrcode from "qrcode"
import NodeCache from "node-cache"
import fs from "fs"
import path from "path"
import pino from 'pino'
import chalk from 'chalk'
import { makeWASocket } from '../lib/simple.js'
import { getSocketSubBotNumber, getSubBotReconnectDelay, hasActiveSubBot } from '../lib/subbot-lifecycle.js'

if (typeof global.wm === 'undefined') {
    global.wm = '𝐂𝐇𝐄𝐎𝐍 𝐁𝐎𝐓'
}

let rtx = `⛄┊≡ ◡̈⃝🧸↜♡︎✿︎𝐂𝐇𝐄𝐎𝐍 𝐁𝐎𝐓 𝚋𝚘𝚝ꨄ︎ఌ
🎤┊≡ ◡̈⃝🎼↜اســتــخــدم هــذا الــكــود لــتــصــبــح بــوت فــرعــي
❄️┊ ۬.͜ـ🧸˖ ↜ الــخــطــوات كــالــتــالــي
╮─ׅ─๋︩︪─┈─๋︩︪─═⊐‹✨›⊏═┈─๋︩︪─
┤─ׅ─ׅ┈ ─๋︩︪──ׅ─ׅ┈ ─๋︩︪─☇
┤┌
│┊𝟣 : اضــغــط عــلــى الــثــلاث نــقــاط
│┊𝟤 : اضــغــط عــلــى الأجــهــزة الــمــرتــبــطــة
│┊𝟥 : امــســح الـرمـز هــذا
┤└─ׅ─ׅ┈ ─๋︩︪──ׅ─ׅ┈ ─๋︩︪☇
╯─ׅ─๋︩︪─┈─๋︩︪─═⊐‹♻️›⊏═┈─๋︩︪⊐`

let rtx2 = `⛄┊≡ ◡̈⃝🧸↜♡︎✿︎𝐂𝐇𝐄𝐎𝐍 𝐁𝐎𝐓 𝚋𝚘𝚝ꨄ︎ఌ
🎤┊≡ ◡̈⃝🎼↜اســتــخــدم هــذا الــكــود لــتــصــبــح بــوت فــرعــي
❄️┊ ۬.͜ـ🧸˖ ↜ الــخــطــوات كــالــتــالــي
╮─ׅ─๋︩︪─┈─๋︩︪─═⊐‹✨›⊏═┈─๋︩︪─
┤─ׅ─ׅ┈ ─๋︩︪──ׅ─ׅ┈ ─๋︩︪─☇
┤┌
│┊𝟣 : اضــغــط عــلــى الــثــلاث نــقــاط
│┊𝟤 : اضــغــط عــلــى الأجــهــزة الــمــرتــبــطــة
│┊𝟥 : اخــتــر ربــط مــع رقــم الــهــاتــف
│┊𝟦 : اكــتــب الــكــود
┤└─ׅ─ׅ┈ ─๋︩︪──ׅ─ׅ┈ ─๋︩︪☇
╯─ׅ─๋︩︪─┈─๋︩︪─═⊐‹♻️›⊏═┈─๋︩︪⊐`

const startingSubBots = new Set()
const terminalSubBots = new Set()
const subBotSockets = new Map()
const subBotReconnectTimers = new Map()
let checkSubBotsRunning = false

function removeSocketFromConns(sock) {
    if (!Array.isArray(global.conns)) return
    for (let i = global.conns.length - 1; i >= 0; i--) {
        if (global.conns[i] === sock) global.conns.splice(i, 1)
    }
}

function removeStaleSubBotSockets(number) {
    for (const sock of [...(global.conns || [])]) {
        if (getSocketSubBotNumber(sock) !== String(number) || sock?.ws?.isOpen === true || sock?.ws?.isConnecting === true) continue
        removeSocketFromConns(sock)
        try { sock.ev?.removeAllListeners?.() } catch {}
        try { sock.ws?.close?.() } catch {}
    }
}

if (global.conns instanceof Array) console.log()
else global.conns = []

let handler = async (m, { conn, args, usedPrefix, command, isOwner, text }) => {
    const botSettings = global.db.data.settings[conn.user.jid] ||= {}
    // التفعيل الافتراضي يمنع ظهور رسالة التعطيل عند إنشاء إعدادات جديدة.
    // يمكن للمطور تعطيل الخاصية لاحقًا بوضع jadibotmd=false.
    if (botSettings.jadibotmd === false) return m.reply('⚠️ خاصية البوتات الفرعية معطلة.')
    if (command === 'تنصيب' && String(text || '').trim().split(/\s+/)[0] === 'تنشيط') {
        if (!isOwner) return m.reply('⚠️ هذا الأمر متاح لمالك البوت فقط.')
        const result = await reactivateSubBots()
        if (result.busy) {
            return m.reply('♻️ بدأ طلب التنشيط؛ فحص البوتات جارٍ الآن، وستتم إعادة المحاولة فور انتهاء الفحص الحالي.')
        }
        if (!result.sessions) return m.reply('ℹ️ لا توجد جلسات بوتات فرعية محفوظة لإعادة تنشيطها.')
        return m.reply(
            `♻️ تم تنفيذ طلب تنشيط البوتات الفرعية.\n` +
            `• جلسات محفوظة: ${result.sessions}\n` +
            `• بدأت إعادة الاتصال: ${result.started}\n` +
            `• تم تجاوزها (متصلة/غير مقترنة): ${result.skipped}\n` +
            `• تعذر بدءها الآن: ${result.failed}\n` +
            `الجلسات المتصلة تُترك كما هي، ولم تُحذف أي ملفات جلسة.`
        )
    }
    if (command === 'تنصيب' && !String(text || '').replace(/\D/g, '')) {
        return m.reply(
            `📱 أرسل رقم حساب البوت الفرعي مع الأمر.\n\n` +
            `مثال:\n${usedPrefix}تنصيب 967715900175\n\n` +
            `اكتب الرقم الدولي بدون علامة +، ثم أدخل الكود في واتساب الخاص بذلك الرقم.`
        )
    }
    // اسمح للمالك بإنشاء بوت فرعي من نفس رقم البوت الأساسي.
    // الحماية من رسائل البوت الذاتية تبقى مفعلة لغير المالك.
    if (conn.user.jid === m.sender && !isOwner) return
    let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.fromMe ? conn.user.jid : m.sender
    let id = `${text ? text.replace(/\D/g, '') : who.split`@`[0]}`
    let pathGataJadiBot = path.join('./jadibts/', id)
    if (!fs.existsSync(pathGataJadiBot)) {
        fs.mkdirSync(pathGataJadiBot, { recursive: true })
    }
    const started = await gataJadiBot({
        pathGataJadiBot,
        m,
        conn,
        args: [...args],
        usedPrefix,
        command,
        fromCommand: true
    }, text)
    if (!started) return m.reply('⚠️ البوت الفرعي متصل أو قيد الاتصال/إعادة المحاولة بالفعل. لم أبدأ جلسة مكررة.')
}

handler.command = /^(jadibot|serbot|rentbot|تنصيب)$/i
export default handler

export async function gataJadiBot(options, text) {
    const sessionId = path.basename(path.resolve(options.pathGataJadiBot))
    const currentSocket = subBotSockets.get(sessionId)
    if (startingSubBots.has(sessionId) || subBotReconnectTimers.has(sessionId) ||
        currentSocket?.ws?.isOpen === true || currentSocket?.ws?.isConnecting === true ||
        hasActiveSubBot(global.conns, sessionId)) return false
    if (terminalSubBots.has(sessionId) && !options.fromCommand) return false
    if (options.fromCommand) terminalSubBots.delete(sessionId)
    startingSubBots.add(sessionId)
    try {
        await startSubBot(options, text, sessionId)
        return true
    } catch (error) {
        startingSubBots.delete(sessionId)
        throw error
    }
}

async function startSubBot(options, text, sessionId) {
    let { pathGataJadiBot, m, conn, args, usedPrefix, command } = options

    // ═══════════════════════════════════════
    // معالجة أمر تنصيب
    // ═══════════════════════════════════════
    if (command === 'تنصيب') {
        command = 'jadibot'
        if (!args.includes('تنصيب') && !args.includes('--تنصيب')) {
            args.unshift('--تنصيب')
        }
    }

    const mcode = args[0] && /(--تنصيب|تنصيب)/.test(args[0].trim()) ? true : args[1] && /(--تنصيب|تنصيب)/.test(args[1].trim()) ? true : false
    let txtCode, codeBot, txtQR

    if (mcode) {
        args[0] = args[0].replace(/^--تنصيب$|^تنصيب$/, '').trim()
        if (args[1]) args[1] = args[1].replace(/^--تنصيب$|^تنصيب$/, '').trim()
        if (args[0] == '') args[0] = undefined
    }

    const pathCreds = path.join(pathGataJadiBot, 'creds.json')
    if (!fs.existsSync(pathGataJadiBot)) {
        fs.mkdirSync(pathGataJadiBot, { recursive: true })
    }

    try {
        args[0] && args[0] != undefined
            ? fs.writeFileSync(pathCreds, JSON.stringify(JSON.parse(Buffer.from(args[0], 'base64').toString('utf-8')), null, '\t'))
            : ''
    } catch {
        conn.reply(m.chat, `*استخدم الأمر بشكل صحيح:* \`${usedPrefix + command} code\``, m)
        return
    }

    // ═══════════════════════════════════════
    // إعداد الاتصال
    // ═══════════════════════════════════════
    let version
    let state
    let saveCreds
    ;({ version } = await fetchLatestBaileysVersion())
    const msgRetry = (MessageRetryMap) => {}
    const msgRetryCache = new NodeCache()
    ;({ state, saveCreds } = await useMultiFileAuthState(pathGataJadiBot))

    const connectionOptions = {
        logger: pino({ level: 'fatal' }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        msgRetry,
        msgRetryCache,
        browser: mcode ? ['Windows', 'Chrome', '110.0.5585.95'] : ['GataBot-MD (Sub Bot)', 'Chrome', '2.0.0'],
        version: version,
        generateHighQualityLinkPreview: true
    }

    let sock = makeWASocket(connectionOptions)
    subBotSockets.set(sessionId, sock)
    sock.isInit = false
    let isInit = true
    let reconnectAttempts = 0
    let scheduleReconnect = () => {}

    // ═══════════════════════════════════════
    // معالجة أحداث الاتصال
    // ═══════════════════════════════════════
    async function connectionUpdate(update) {
        const { connection, lastDisconnect, isNewLogin, qr } = update
        if (isNewLogin) sock.isInit = false

        // ─── QR Code ───
        if (qr && !mcode) {
            if (m?.chat) {
                txtQR = await conn.sendMessage(m.chat, {
                    image: await qrcode.toBuffer(qr, { scale: 8 }),
                    caption: rtx.trim() + '\n'
                }, { quoted: m })
                if (txtQR?.key) {
                    setTimeout(() => conn.sendMessage(m.sender, { delete: txtQR.key }), 30000)
                }
            }
            return
        }

        // ─── Pairing Code ───
        if (qr && mcode) {
            let fixTe = text ? text.replace(/\D/g, '') : m.sender.split('@')[0]
            let secret = await sock.requestPairingCode(fixTe)
            secret = secret.match(/.{1,4}/g)?.join('-') || secret
            const dispositivo = await getDevice(m.key.id)

            if (!m.isWABusiness) {
                if (/web|desktop|unknown/i.test(dispositivo)) {
                    txtCode = await conn.sendMessage(m.chat, {
                        image: { url: 'https://s7.ezgif.com/tmp/ezgif-7905c1c9baa94fbc.jpg' },
                        caption: rtx2.trim() + '\n'
                    }, { quoted: m })
                    codeBot = await m.reply(secret)
                } else {
                    txtCode = await conn.sendButton(
                        m.chat,
                        rtx2.trim(),
                        global.wm + `\n*الــكــود 🌺:* ${secret}`,
                        'https://files.catbox.moe/azc9kk.jpg',
                        null,
                        [['🫐 نـسـخ الـكـود 🫐', secret]],
                        null, null, m
                    )
                }
            } else {
                txtCode = await conn.sendMessage(m.chat, {
                    image: { url: 'https://h.uguu.se/GUHtpVKY.jpg' },
                    caption: rtx2.trim() + '\n'
                }, { quoted: m })
                codeBot = await m.reply(secret)
            }
        }

        if ((txtCode?.key || txtCode?.id)) {
            setTimeout(() => conn.sendMessage(m.sender, { delete: txtCode.key || txtCode.id }), 30000)
        }
        if (codeBot?.key) {
            setTimeout(() => conn.sendMessage(m.sender, { delete: codeBot.key }), 30000)
        }

        const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode

        if (connection === 'close') {
            removeSocketFromConns(sock)
            // 401 تعني أن واتساب سجّل خروج الجهاز؛ إعادة الاتصال وحدها لن تعيد ربطه.
            // كل الانقطاعات الأخرى تُعامل كعابرة وتستمر معها المحاولات تلقائيًا.
            const terminal = reason === 401
            if (terminal) {
                terminalSubBots.add(sessionId)
                startingSubBots.delete(sessionId)
                const timer = subBotReconnectTimers.get(sessionId)
                if (timer) clearTimeout(timer)
                subBotReconnectTimers.delete(sessionId)
                console.error(chalk.redBright(`┆ جلسة البوت الفرعي (+${sessionId}) توقفت برمز ${reason}; ملفات الجلسة محفوظة ولم تُحذف. قد تحتاج إعادة ربط يدوية.`))
                if (options.fromCommand && m?.chat) {
                    await conn.sendMessage(m.chat, {
                        text: `⚠️ توقفت جلسة البوت الفرعي برمز ${reason}. ملفات الجلسة لم تُحذف؛ قد يلزم إعادة ربطها يدويًا.`
                    }, { quoted: m }).catch(() => {})
                }
            } else {
                console.warn(chalk.yellowBright(`┆ انقطع البوت الفرعي (+${sessionId}) برمز ${reason ?? 'غير معروف'}؛ ستتم إعادة المحاولة تلقائيًا.`))
                scheduleReconnect(reason)
            }
        }

        // ═══════════════════════════════════════
        // فحص قاعدة البيانات
        // ═══════════════════════════════════════
        if (global.db.data == null) loadDatabase()

        // ═══════════════════════════════════════
        // الاتصال ناجح
        // ═══════════════════════════════════════
        if (connection === 'open') {
            reconnectAttempts = 0
            startingSubBots.delete(sessionId)
            terminalSubBots.delete(sessionId)
            const timer = subBotReconnectTimers.get(sessionId)
            if (timer) clearTimeout(timer)
            subBotReconnectTimers.delete(sessionId)
            if (!global.db.data?.users) loadDatabase()

            let userName = sock.authState.creds.me.name || 'مجهول'
            let userJid = sock.authState.creds.me.jid || `${path.basename(pathGataJadiBot)}@s.whatsapp.net`

            console.log(chalk.bold.cyanBright(`\n✅ ${userName} (+${path.basename(pathGataJadiBot)}) متصل بنجاح.\n`))

            sock.isInit = true
            subBotSockets.set(sessionId, sock)
            for (const oldSock of [...global.conns]) {
                if (oldSock === sock || getSocketSubBotNumber(oldSock) !== sessionId) continue
                removeSocketFromConns(oldSock)
                try { oldSock.ev?.removeAllListeners?.() } catch {}
                try { oldSock.ws?.close?.() } catch {}
            }
            if (!global.conns.includes(sock)) global.conns.push(sock)
            console.log(`📢 إجمالي البوتات الفرعية النشطة: ${global.conns.length}`)

            // ─── رسالة النجاح ───
            if (m?.chat && options.fromCommand) {
                await conn.sendMessage(m.chat, {
                    text: `\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n┆ ✅ تم الاتصال بنجاح\n┆ 📱 الرقم: ${path.basename(pathGataJadiBot)}\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
                    contextInfo: {
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: '120363404349859805@newsletter',
                            newsletterName: '𝐂𝐇𝐄𝐎𝐍 𝐁𝐎𝐓 Bot',
                            serverMessageId: -1
                        }
                    }
                }, { quoted: m })
            }

            // ─── إشعار القناة ───
            try {
                let chtxt = `*اتصال بوت فرعي ✅*\n\n*👤 المستخدم:* ${userName}\n*📞 الرقم:* ${path.basename(pathGataJadiBot)}`
                if (global.ch?.ch1) {
                    await global.conn.sendMessage(global.ch.ch1, { text: chtxt })
                }
            } catch {}

            await joinChannels(sock)
        }
    }

    // ═══════════════════════════════════════
    // تحميل وتحديث المعالج
    // ═══════════════════════════════════════
    let handler = await import('../handler.js')
    let creloadHandler = async function (restatConn) {
        try {
            const Handler = await import(`../handler.js?update=${Date.now()}`).catch(console.error)
            if (Object.keys(Handler || {}).length) handler = Handler
        } catch (e) {
            console.error('خطأ:', e)
        }

        if (restatConn) {
            const oldChats = sock.chats
            removeSocketFromConns(sock)
            try { sock.ev.removeAllListeners() } catch {}
            try { sock.ws.close() } catch {}
            sock = makeWASocket(connectionOptions, { chats: oldChats })
            subBotSockets.set(sessionId, sock)
            isInit = true
        }

        if (!isInit) {
            sock.ev.off('messages.upsert', sock.handler)
            sock.ev.off('group-participants.update', sock.participantsUpdate)
            sock.ev.off('groups.update', sock.groupsUpdate)
            sock.ev.off('message.delete', sock.onDelete)
            sock.ev.off('call', sock.onCall)
            sock.ev.off('connection.update', sock.connectionUpdate)
            sock.ev.off('creds.update', sock.credsUpdate)
        }

        sock.handler = handler.handler.bind(sock)
        sock.participantsUpdate = handler.participantsUpdate.bind(sock)
        sock.groupsUpdate = handler.groupsUpdate.bind(sock)
        sock.onDelete = handler.deleteUpdate.bind(sock)
        sock.onCall = handler.callUpdate.bind(sock)
        sock.connectionUpdate = connectionUpdate.bind(sock)
        sock.credsUpdate = saveCreds.bind(sock, true)

        sock.ev.on('messages.upsert', sock.handler)
        sock.ev.on('group-participants.update', sock.participantsUpdate)
        sock.ev.on('groups.update', sock.groupsUpdate)
        sock.ev.on('message.delete', sock.onDelete)
        sock.ev.on('call', sock.onCall)
        sock.ev.on('connection.update', sock.connectionUpdate)
        sock.ev.on('creds.update', sock.credsUpdate)
        isInit = false
        return true
    }
    scheduleReconnect = (reason) => {
        if (terminalSubBots.has(sessionId) || subBotReconnectTimers.has(sessionId)) return
        const attempt = reconnectAttempts++
        const delay = getSubBotReconnectDelay(attempt)
        console.warn(chalk.yellowBright(`┆ إعادة اتصال البوت الفرعي (+${sessionId}) بعد ${Math.ceil(delay / 1000)} ثانية (محاولة ${attempt + 1})`))
        const timer = setTimeout(async () => {
            subBotReconnectTimers.delete(sessionId)
            startingSubBots.add(sessionId)
            try {
                await creloadHandler(true)
                startingSubBots.delete(sessionId)
            } catch (error) {
                startingSubBots.delete(sessionId)
                console.error(chalk.redBright(`فشل إنشاء socket بديل (+${sessionId}, ${reason ?? 'غير معروف'}):`), error.message)
                scheduleReconnect('socket-create-failed')
            }
        }, delay)
        timer.unref?.()
        subBotReconnectTimers.set(sessionId, timer)
    }
    await creloadHandler(false)
    startingSubBots.delete(sessionId)
}

async function joinChannels(conn) {
    for (const channelId of Object.values(global.ch || {})) {
        if (channelId && channelId.endsWith('@newsletter')) {
            await conn.newsletterFollow(channelId).catch(() => {})
        }
    }
}

export async function reactivateSubBots() {
    for (const [sessionId, timer] of subBotReconnectTimers) {
        clearTimeout(timer)
        subBotReconnectTimers.delete(sessionId)
    }
    terminalSubBots.clear()
    return checkSubBots()
}

// ═══════════════════════════════════════
// مراقبة البوتات الفرعية كل دقيقة
// ═══════════════════════════════════════
export async function checkSubBots() {
    const result = { busy: false, sessions: 0, started: 0, skipped: 0, failed: 0 }
    if (checkSubBotsRunning) return { ...result, busy: true }
    checkSubBotsRunning = true
    try {
        const subBotDir = path.resolve('./jadibts')
        if (!fs.existsSync(subBotDir)) return result

        const folders = fs.readdirSync(subBotDir)
            .filter(f => fs.statSync(path.join(subBotDir, f)).isDirectory())

        for (const folder of folders) {
            const botPath = path.join(subBotDir, folder)
            const credsPath = path.join(botPath, 'creds.json')
            if (!fs.existsSync(credsPath)) continue
            result.sessions++

            try {
                const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'))
                if (creds.registered === false && !creds.me?.id) {
                    result.skipped++
                    continue
                }
            } catch (error) {
                result.failed++
                console.warn(`[SUBBOT WATCHDOG] جلسة غير قابلة للقراءة (+${folder}); لم تُحذف: ${error.message}`)
                continue
            }

            removeStaleSubBotSockets(folder)
            const tracked = subBotSockets.get(folder)
            if (tracked && tracked.ws?.isOpen !== true && tracked.ws?.isConnecting !== true && !subBotReconnectTimers.has(folder)) {
                subBotSockets.delete(folder)
            }
            const current = subBotSockets.get(folder)
            if (terminalSubBots.has(folder) || startingSubBots.has(folder) || subBotReconnectTimers.has(folder) ||
                current?.ws?.isOpen === true || current?.ws?.isConnecting === true || hasActiveSubBot(global.conns, folder)) {
                result.skipped++
                continue
            }

            console.log(chalk.yellowBright(`\n┆ اكتشف المراقب جلسة غير متصلة (+${folder})؛ بدء الاتصال دون حذف ملفاتها...\n`))
            try {
                const started = await gataJadiBot({
                    pathGataJadiBot: botPath,
                    m: null,
                    conn: global.conn,
                    args: [],
                    usedPrefix: '.',
                    command: 'jadibot',
                    fromCommand: false
                })
                if (started) result.started++
                else result.skipped++
            } catch (error) {
                result.failed++
                console.error(chalk.redBright(`فشل تشغيل (+${folder})؛ ستتم إعادة المحاولة في الفحص التالي:`), error.message)
            }
        }
        return result
    } finally {
        checkSubBotsRunning = false
    }
}

const subBotWatchdog = setInterval(() => {
    checkSubBots().catch(error => console.error('[SUBBOT WATCHDOG]', error.message))
}, 60_000)
subBotWatchdog.unref?.()
