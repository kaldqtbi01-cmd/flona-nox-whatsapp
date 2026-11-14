// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  FLONA BOT — نظام اتصال WhatsApp المستقل
//  المكتبة: @whiskeysockets/baileys (النسخة المثبتة: baileyshulk 1.4.5
//  من github:Loydsumer/baileys-speed). كل الدوال والأحداث المستخدمة هنا
//  موجودة في هذا الإصدار:
//    makeWASocket · useMultiFileAuthState · makeCacheableSignalKeyStore
//    fetchLatestBaileysVersion · DisconnectReason · jidNormalizedUser
//    sock.requestPairingCode(phone, pairKey) · sock.end(error)
//    الأحداث: connection.update · creds.update · messages.upsert
//             groups.update · group-participants.update
//
//  قواعد هذا الملف:
//  - لا يحذف ملفات الجلسة أبداً (إعادة الاقتران تنقل المجلد إلى نسخة احتياطية).
//  - لا يطبع بيانات الجلسة أو المفاتيح أو رقم الهاتف كاملاً.
//  - اتصال واحد فقط في نفس الوقت (قفل داخل العملية + ملف قفل بين العمليات).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import fs from "fs"
import path from "path"
import dns from "dns"
import readline from "readline"
import { EventEmitter } from "events"
import { fileURLToPath } from "url"
import pino from "pino"
import QRCode from "qrcode"
import NodeCache from "node-cache"
import phoneLib from "google-libphonenumber"

// الحزمة CommonJS: الـ default في Node هو module.exports كاملاً (نفس أسلوب lib/simple.js)
const baileys = (await import("@whiskeysockets/baileys")).default
const {
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    DisconnectReason,
    jidNormalizedUser,
} = baileys

const { PhoneNumberUtil } = phoneLib
const phoneUtil = PhoneNumberUtil.getInstance()

// ━━━ المسارات الثابتة ━━━
const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT_DIR      = path.resolve(__dirname, "..")
export const AUTH_DIR_NAME = "auth_info_baileys"
export const AUTH_DIR      = path.join(ROOT_DIR, AUTH_DIR_NAME)
const CREDS_FILE           = path.join(AUTH_DIR, "creds.json")
const DATA_DIR             = path.join(ROOT_DIR, "data")
const LOCK_FILE            = path.join(DATA_DIR, "whatsapp.lock")
const STATUS_FILE          = path.join(DATA_DIR, "whatsapp-status.json")
const QR_PNG_FILE          = path.join(DATA_DIR, "whatsapp-qr.png")
// مجلدات جلسات قديمة تُنسخ (ولا تُحذف) إلى auth_info_baileys عند أول تشغيل
const LEGACY_AUTH_DIRS     = ["sessions"]

// ━━━ إعدادات إعادة الاتصال ━━━
const RECONNECT_BASE_MS       = 2_000
const RECONNECT_MAX_MS        = 60_000
const RATE_LIMIT_DELAY_MS     = 30_000
const MAX_PAIRING_ATTEMPTS    = 10   // محاولات الاقتران قبل التوقف (كل محاولة ≈ دقيقة QR)
const MAX_BAD_SESSION_STRIKES = 5    // أخطاء جلسة متتالية قبل التوقف (بدون حذف)

const S = Object.freeze({
    IDLE: "idle",
    CONNECTING: "connecting",
    WAITING_PAIR: "waiting_pair",
    OPEN: "open",
    RECONNECTING: "reconnecting",
    LOGGED_OUT: "logged_out",
    STOPPED: "stopped",
})
export const ConnectionState = S

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  أدوات مساعدة
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** يخفي الرقم: 9677******93 */
export function maskNumber(value = "") {
    const d = String(value).split("@")[0].split(":")[0].replace(/\D/g, "")
    if (d.length <= 6) return "***"
    return `${d.slice(0, 4)}${"*".repeat(d.length - 6)}${d.slice(-2)}`
}

/** رسالة خطأ آمنة للسجل: الكود + نص مختصر، بدون stack أو data */
function safeErrorText(error) {
    if (!error) return "unknown"
    const msg = String(error.message || error).split("\n")[0].slice(0, 160)
    return msg
}

function readJsonSafe(file) {
    try { return JSON.parse(fs.readFileSync(file, "utf8")) } catch { return null }
}

function writeJsonSafe(file, data) {
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, JSON.stringify(data, null, 2))
    } catch {}
}

/** جلسة صالحة = creds.json يحتوي me.id (ينطبق على QR والـ Pairing Code معاً) */
export function hasSavedSession(dir = AUTH_DIR) {
    const creds = readJsonSafe(path.join(dir, "creds.json"))
    return !!creds?.me?.id
}

function isValidPhone(digits) {
    try {
        return phoneUtil.isValidNumber(phoneUtil.parseAndKeepRawInput(`+${digits}`))
    } catch { return false }
}

function normalizePhone(raw = "") {
    return String(raw).replace(/\D/g, "").replace(/^00/, "")
}

async function isOnline() {
    try {
        await Promise.race([
            dns.promises.lookup("web.whatsapp.com"),
            sleep(5000).then(() => { throw new Error("dns timeout") }),
        ])
        return true
    } catch { return false }
}

function getDisconnectCode(lastDisconnect) {
    const err = lastDisconnect?.error
    return err?.output?.statusCode ?? err?.output?.payload?.statusCode ?? err?.statusCode
}

/** أخطاء WebSocket/الشبكة تُرجعها Baileys أحياناً بكود 500 — لا نعاملها كجلسة تالفة */
function isNetworkError(error) {
    const msg = String(error?.message || "")
    const code = error?.data?.code || error?.code || ""
    return msg.startsWith("WebSocket Error") || /^E[A-Z]+/.test(code) || /timed out|ECONN|ENOTFOUND|EAI_AGAIN/i.test(msg)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  قفل بين العمليات: يمنع تشغيل نسختين من البوت بنفس الجلسة
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function pidAlive(pid) {
    if (!pid || pid === process.pid) return false
    try { process.kill(pid, 0); return true } catch (e) { return e.code === "EPERM" }
}

function acquireProcessLock() {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const existing = readJsonSafe(LOCK_FILE)
    if (existing?.pid && pidAlive(existing.pid)) {
        return { ok: false, pid: existing.pid }
    }
    writeJsonSafe(LOCK_FILE, { pid: process.pid, startedAt: new Date().toISOString() })
    const release = () => {
        try {
            const cur = readJsonSafe(LOCK_FILE)
            if (cur?.pid === process.pid) fs.unlinkSync(LOCK_FILE)
        } catch {}
    }
    process.once("exit", release)
    return { ok: true, release }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ترحيل الجلسة القديمة (نسخ فقط — لا حذف)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function migrateLegacySession(log) {
    if (fs.existsSync(CREDS_FILE)) return
    for (const name of LEGACY_AUTH_DIRS) {
        const legacy = path.join(ROOT_DIR, name)
        if (!fs.existsSync(path.join(legacy, "creds.json"))) continue
        try {
            fs.cpSync(legacy, AUTH_DIR, { recursive: true, errorOnExist: false, force: false })
            log.info(`📦 تم نسخ الجلسة الحالية من ./${name} إلى ./${AUTH_DIR_NAME} (المجلد القديم لم يُحذف)`)
            return
        } catch (e) {
            log.error(`❌ فشل نسخ الجلسة القديمة: ${safeErrorText(e)}`)
        }
    }
}

/** إعادة اقتران: ينقل المجلد الحالي إلى نسخة احتياطية بدل حذفه */
function archiveSessionForRelink(log) {
    if (!fs.existsSync(AUTH_DIR)) return null
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const target = path.join(ROOT_DIR, `${AUTH_DIR_NAME}.bak-${stamp}`)
    fs.renameSync(AUTH_DIR, target)
    log.info(`🗂️  الجلسة السابقة محفوظة في ./${path.basename(target)} — سيتم اقتران جديد`)
    return target
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  مدير الاتصال
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class WhatsAppConnection extends EventEmitter {
    /**
     * @param {object} o
     * @param {(config: object) => any} o.makeSocket  مصنع السوكت (lib/simple.js → makeWASocket)
     * @param {"qr"|"code"|undefined} o.method        طريقة الاقتران المطلوبة
     * @param {string|undefined} o.phoneNumber        رقم الاقتران (من البيئة/السطر، ليس من الكود)
     * @param {boolean} o.relink                      نقل الجلسة الحالية والاقتران من جديد
     * @param {object} o.socketOptions                خيارات إضافية لـ makeWASocket
     * @param {(key) => Promise<any>} o.getMessage    مصدر إضافي للرسائل (store)
     * @param {object} o.log                          { info, warn, error, qr }
     */
    constructor(o) {
        super()
        this.setMaxListeners(50)
        this.opts = o
        this.log = o.log
        this.sock = null
        this.state = S.IDLE
        this.generation = 0
        this.connectingNow = false
        this.reconnectTimer = null
        this.reconnectAttempts = 0
        this.pairingAttempts = 0
        this.badSessionStrikes = 0
        this.pairingRequestedFor = -1
        this.version = null
        this.auth = null
        this.method = o.method
        this.phoneNumber = o.phoneNumber

        this.msgRetryCounterCache = new NodeCache({ stdTTL: 300, useClones: false })
        this.userDevicesCache     = new NodeCache({ stdTTL: 300, useClones: false })
        this.groupCache           = new NodeCache({ stdTTL: 300, useClones: false })
        this.messageCache         = new Map()
    }

    get isOpen() { return this.state === S.OPEN }

    _setState(state) {
        if (this.state === state) return
        this.state = state
        this.emit("state", state)
    }

    // ── التهيئة ──
    async init() {
        migrateLegacySession(this.log)

        if (this.opts.relink) {
            archiveSessionForRelink(this.log)
            writeJsonSafe(STATUS_FILE, { state: "relink", at: new Date().toISOString() })
        }

        // جلسة سُجّل خروجها سابقاً: لا نحاول الاتصال بها إلا بعد إعادة الاقتران
        const status = readJsonSafe(STATUS_FILE)
        if (status?.state === S.LOGGED_OUT && hasSavedSession()) {
            this._setState(S.LOGGED_OUT)
            this._printLoggedOutHelp()
            return false
        }

        fs.mkdirSync(AUTH_DIR, { recursive: true })
        this.auth = await useMultiFileAuthState(AUTH_DIR)

        if (!this.auth.state.creds?.me?.id) {
            await this._chooseLoginMethod()
        } else {
            this.log.info(`🔐 تم العثور على جلسة محفوظة في ./${AUTH_DIR_NAME} — لن يُطلب QR`)
        }
        return true
    }

    async _ask(question) {
        if (!process.stdin.isTTY) return null
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
        try { return await new Promise((r) => rl.question(question, r)) } finally { rl.close() }
    }

    async _chooseLoginMethod() {
        let method = this.method
        let phone = normalizePhone(this.phoneNumber || "")

        if (!method) method = phone ? "code" : null
        if (!method && process.stdin.isTTY) {
            let answer
            do {
                answer = (await this._ask("🪻 اختر طريقة الاتصال:\n1. QR Code\n2. Pairing Code\n--> "))?.trim()
            } while (answer !== "1" && answer !== "2")
            method = answer === "2" ? "code" : "qr"
        }
        if (!method) method = "qr"

        if (method === "code") {
            while (!phone || !isValidPhone(phone)) {
                if (phone) this.log.warn("❌ الرقم غير صالح. اكتبه بالصيغة الدولية بدون + (مثال: 9677XXXXXXXX)")
                const answer = await this._ask("🪻 أدخل رقم واتساب البوت بالصيغة الدولية:\n--> ")
                if (answer == null) {
                    this.log.warn("⚠️  لا يوجد رقم صالح (WA_PHONE_NUMBER) ولا طرفية تفاعلية — سيتم استخدام QR")
                    method = "qr"
                    phone = ""
                    break
                }
                phone = normalizePhone(answer)
            }
        }

        this.method = method
        this.phoneNumber = phone || undefined
        this.log.info(method === "code"
            ? `🔢 طريقة الاقتران: Pairing Code للرقم ${maskNumber(phone)}`
            : "📷 طريقة الاقتران: QR Code")
    }

    async _getVersion() {
        if (this.version) return this.version
        try {
            const { version, isLatest } = await fetchLatestBaileysVersion({ timeout: 10_000 })
            this.version = version
            this.log.info(`📦 WA Web version: ${version.join(".")}${isLatest ? "" : " (النسخة المضمّنة في المكتبة)"}`)
        } catch {
            this.version = undefined // تستخدم Baileys النسخة الافتراضية
        }
        return this.version
    }

    _cacheMessages({ messages } = {}) {
        for (const msg of messages || []) {
            if (!msg?.key?.id || !msg.message) continue
            this.messageCache.set(msg.key.id, msg.message)
            if (this.messageCache.size > 1000) {
                this.messageCache.delete(this.messageCache.keys().next().value)
            }
        }
    }

    _buildConfig(version) {
        const { state } = this.auth
        const silent = pino({ level: "silent" })
        const extra = this.opts.socketOptions || {}
        return {
            ...(version ? { version } : {}),
            logger: silent,
            printQRInTerminal: false, // نطبع الـ QR بأنفسنا عبر مكتبة qrcode
            browser: ["Ubuntu", "Chrome", "120.0.0"], // نفس هوية الجهاز السابقة
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, silent),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            connectTimeoutMs: 60_000,
            defaultQueryTimeoutMs: 60_000,
            keepAliveIntervalMs: 30_000,
            retryRequestDelayMs: 250,
            msgRetryCounterCache: this.msgRetryCounterCache,
            userDevicesCache: this.userDevicesCache,
            cachedGroupMetadata: async (jid) => this.groupCache.get(jid),
            getMessage: async (key) => {
                const cached = this.messageCache.get(key?.id)
                if (cached) return cached
                try {
                    const fromStore = await this.opts.getMessage?.(key)
                    return fromStore?.message || fromStore || undefined
                } catch { return undefined }
            },
            ...extra,
        }
    }

    /** كاش لبيانات المجموعات: يقلل طلبات groupMetadata (سبب شائع لخطأ 429) */
    _wrapGroupMetadata(sock) {
        const original = sock.groupMetadata
        if (typeof original !== "function") return
        const cache = this.groupCache
        try {
            sock.groupMetadata = async (jid, ...rest) => {
                const hit = cache.get(jid)
                if (hit) return hit
                const md = await original.call(sock, jid, ...rest)
                if (md) cache.set(jid, md)
                return md
            }
        } catch {}
        sock.ev.on("groups.update", (updates) => {
            for (const u of updates || []) if (u?.id) cache.del(u.id)
        })
        sock.ev.on("group-participants.update", ({ id }) => { if (id) cache.del(id) })
    }

    // ── إنشاء الاتصال (محمي من التكرار) ──
    async connect() {
        if (this.state === S.LOGGED_OUT || this.state === S.STOPPED) return
        if (this.connectingNow) return
        this.connectingNow = true
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null

        try {
            if (!(await isOnline())) {
                this.log.warn("📡 لا يوجد اتصال بالإنترنت — سيُعاد المحاولة تلقائياً")
                this.connectingNow = false
                return this._scheduleReconnect("offline")
            }

            this._teardown()
            const version = await this._getVersion()
            const gen = ++this.generation
            this._setState(S.CONNECTING)

            const sock = this.opts.makeSocket(this._buildConfig(version))
            this.sock = sock

            sock.ev.on("creds.update", this.auth.saveCreds)
            sock.ev.on("connection.update", (u) => {
                this._onConnectionUpdate(u, gen).catch((e) =>
                    this.log.error(`❌ خطأ في معالجة حالة الاتصال: ${safeErrorText(e)}`))
            })
            sock.ev.on("messages.upsert", (u) => this._cacheMessages(u))
            this._wrapGroupMetadata(sock)

            this.emit("socket", sock)
        } catch (e) {
            this.log.error(`❌ فشل إنشاء الاتصال: ${safeErrorText(e)}`)
            this._scheduleReconnect("create-failed")
        } finally {
            this.connectingNow = false
        }
    }

    /** يغلق السوكت الحالي بدون أن يطلق إعادة اتصال (لا يسجّل خروج ولا يحذف الجلسة) */
    _teardown() {
        const old = this.sock
        if (!old) return
        this.generation++ // أي حدث متأخر من السوكت القديم يتم تجاهله
        this.sock = null
        try { old.ev?.removeAllListeners?.() } catch {}
        try { old.end?.(undefined) } catch {}
        try { old.ws?.close?.() } catch {}
    }

    async _onConnectionUpdate(update, gen) {
        if (gen !== this.generation) return // حدث من سوكت قديم
        const { connection, lastDisconnect, qr, isNewLogin } = update
        const sock = this.sock

        if (isNewLogin) this.emit("new-login")

        if (qr) {
            this._setState(S.WAITING_PAIR)
            if (this.method === "code" && this.phoneNumber) {
                await this._requestPairingCode(sock, gen)
            } else {
                await this._showQR(qr)
            }
        }

        if (connection === "connecting") {
            this.emit("connecting")
        }

        if (connection === "open") {
            this.reconnectAttempts = 0
            this.pairingAttempts = 0
            this.badSessionStrikes = 0
            this.pairingRequestedFor = -1
            this._setState(S.OPEN)
            writeJsonSafe(STATUS_FILE, { state: S.OPEN, at: new Date().toISOString() })
            try { fs.unlinkSync(QR_PNG_FILE) } catch {}
            const me = sock?.user?.id ? jidNormalizedUser(sock.user.id) : ""
            this.log.info(`✅ متصل بواتساب (${maskNumber(me)})`)
            this.emit("open", sock)
        }

        if (connection === "close") {
            this.emit("close", { lastDisconnect })
            this._handleClose(lastDisconnect)
        }
    }

    async _requestPairingCode(sock, gen) {
        if (!sock || this.pairingRequestedFor === gen) return
        if (sock.authState?.creds?.me?.id || sock.authState?.creds?.registered) return
        this.pairingRequestedFor = gen
        try {
            // مفتاح مخصص اختياري (8 أحرف/أرقام). بدونه نمرر null ليولّد Baileys كوداً عشوائياً
            // (بدلاً من الكود الثابت الافتراضي في هذا الإصدار).
            const custom = (process.env.WA_PAIRING_KEY || "").toUpperCase()
            const pairKey = /^[A-Z0-9]{8}$/.test(custom) ? custom : null
            let code = await sock.requestPairingCode(this.phoneNumber, pairKey)
            code = code?.match(/.{1,4}/g)?.join("-") || code
            this.log.qr(`\n🔢 كود الاقتران: ${code}\n` +
                "   واتساب ← الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف بدلاً من ذلك\n")
            this.emit("pairing-code", code)
        } catch (e) {
            this.pairingRequestedFor = -1
            this.log.error(`❌ فشل طلب كود الاقتران: ${safeErrorText(e)}`)
        }
    }

    async _showQR(qr) {
        try {
            const ascii = await QRCode.toString(qr, { type: "terminal", small: true })
            this.log.qr(`\n📷 امسح رمز QR من واتساب ← الأجهزة المرتبطة ← ربط جهاز\n${ascii}`)
            fs.mkdirSync(DATA_DIR, { recursive: true })
            await QRCode.toFile(QR_PNG_FILE, qr, { width: 512, margin: 2 })
            this.log.info(`🖼️  نسخة صورة من الـ QR: ./data/${path.basename(QR_PNG_FILE)} (تتجدد تلقائياً)`)
            this.emit("qr", qr)
        } catch (e) {
            this.log.error(`❌ تعذر عرض QR: ${safeErrorText(e)}`)
        }
    }

    _handleClose(lastDisconnect) {
        const error = lastDisconnect?.error
        const code = getDisconnectCode(lastDisconnect)
        const registered = !!this.auth?.state?.creds?.me?.id
        const why = `${code ?? "?"} — ${safeErrorText(error)}`

        // تسجيل خروج: لا إعادة اتصال حتى إعادة الاقتران
        if (code === DisconnectReason.loggedOut && registered) {
            this._setState(S.LOGGED_OUT)
            writeJsonSafe(STATUS_FILE, { state: S.LOGGED_OUT, at: new Date().toISOString(), code })
            this._teardown()
            this._printLoggedOutHelp()
            this.emit("logged-out")
            return
        }

        if (code === DisconnectReason.connectionReplaced) {
            this._stop(`⚠️  تم فتح نفس الجلسة من مكان آخر (440). أوقفت الاتصال لتجنب التعارض.\n` +
                `   أغلق النسخة الأخرى ثم أعد تشغيل البوت.`)
            return
        }

        if (code === DisconnectReason.forbidden || code === DisconnectReason.multideviceMismatch) {
            this._stop(`⛔ رفض واتساب الجلسة (${why}). أعد الاقتران: npm run relink`)
            return
        }

        if (code === DisconnectReason.restartRequired) {
            this.log.info("🔄 واتساب طلب إعادة تشغيل الاتصال (طبيعي بعد الاقتران)...")
            return this._scheduleReconnect("restart-required", 500)
        }

        // مرحلة الاقتران (لم يتم ربط الجهاز بعد)
        if (!registered) {
            this.pairingAttempts++
            if (this.pairingAttempts > MAX_PAIRING_ATTEMPTS) {
                this._stop(`⌛ انتهت مهلة الاقتران بعد ${MAX_PAIRING_ATTEMPTS} محاولات. أعد تشغيل البوت للمحاولة من جديد.`)
                return
            }
            this.log.warn(`⏳ لم يكتمل الاقتران (${why}) — محاولة ${this.pairingAttempts}/${MAX_PAIRING_ATTEMPTS}`)
            return this._scheduleReconnect("pairing", 3_000)
        }

        if (code === DisconnectReason.badSession && !isNetworkError(error)) {
            this.badSessionStrikes++
            if (this.badSessionStrikes > MAX_BAD_SESSION_STRIKES) {
                this._stop(`⚠️  خطأ متكرر في الجلسة (${why}). الملفات لم تُحذف.\n` +
                    `   إن استمرت المشكلة استخدم: npm run relink`)
                return
            }
            this.log.warn(`⚠️  خطأ جلسة (${why}) — إعادة المحاولة ${this.badSessionStrikes}/${MAX_BAD_SESSION_STRIKES}`)
            return this._scheduleReconnect("bad-session")
        }

        if (code === 429) {
            this.log.warn("⚠️  تم تقييد الطلبات (429) — انتظار قبل إعادة الاتصال")
            return this._scheduleReconnect("rate-limit", RATE_LIMIT_DELAY_MS)
        }

        // انقطاع مؤقت: 428 / 408 / 503 / أخطاء الشبكة / غير معروف
        this.log.warn(`🔌 انقطع الاتصال (${why}) — إعادة اتصال تلقائية`)
        this._scheduleReconnect("transient")
    }

    _scheduleReconnect(reason, fixedDelay) {
        if (this.state === S.LOGGED_OUT || this.state === S.STOPPED) return
        if (this.reconnectTimer) return // إعادة اتصال مجدولة مسبقاً
        this._setState(S.RECONNECTING)
        const attempt = this.reconnectAttempts++
        const delay = fixedDelay ?? Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt) + Math.floor(Math.random() * 1000)
        if (fixedDelay == null) this.log.info(`⏱️  إعادة الاتصال بعد ${Math.round(delay / 1000)} ث (${reason})`)
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connect()
        }, delay)
    }

    _stop(message) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
        this._teardown()
        this._setState(S.STOPPED)
        this.log.error(message)
        this.emit("stopped")
    }

    _printLoggedOutHelp() {
        this.log.error(
            "💀 تم تسجيل الخروج من واتساب — لن يعيد البوت الاتصال تلقائياً.\n" +
            "   لإعادة الاقتران (الجلسة القديمة تُنقل لنسخة احتياطية ولا تُحذف):\n" +
            "     npm run relink          ← QR\n" +
            "     npm run relink:code     ← Pairing Code (مع WA_PHONE_NUMBER)")
    }

    /** إعادة تشغيل الاتصال يدوياً (تستخدمها reloadHandler(true) والـ Watchdog) */
    async restart(reason = "manual") {
        if (this.state === S.LOGGED_OUT) return this._printLoggedOutHelp()
        if (this.connectingNow || this.reconnectTimer) return
        if (this.state === S.STOPPED) this.state = S.IDLE
        this.log.info(`🔄 إعادة تشغيل اتصال واتساب (${reason})`)
        this._teardown()
        await this.connect()
    }

    /** إيقاف نظيف بدون تسجيل خروج (الجلسة تبقى صالحة) */
    async shutdown() {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
        this.state = S.STOPPED
        this._teardown()
        await sleep(300) // مهلة قصيرة لإكمال كتابة creds
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  نقطة الدخول — اتصال واحد فقط لكل عملية
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let singleton = null

/**
 * يبدأ اتصال واتساب (أو يعيد المدير الحالي إن كان يعمل).
 * @returns {Promise<WhatsAppConnection>}
 */
export async function startWhatsApp(options) {
    if (singleton) return singleton

    const log = {
        info:  options.log?.info  || console.log,
        warn:  options.log?.warn  || console.warn,
        error: options.log?.error || console.error,
        qr:    options.log?.qr    || console.log,
    }

    const lock = acquireProcessLock()
    if (!lock.ok) {
        log.error(`⛔ يوجد نسخة أخرى من البوت تعمل بنفس الجلسة (PID ${lock.pid}). أوقفها أولاً.`)
        process.exit(1)
    }

    const conn = new WhatsAppConnection({ ...options, log })
    singleton = conn

    const ready = await conn.init()
    if (ready) await conn.connect()

    const graceful = async (signal) => {
        log.info(`🛑 ${signal}: إيقاف البوت مع الحفاظ على الجلسة...`)
        await conn.shutdown().catch(() => {})
        lock.release?.()
        process.exit(0)
    }
    process.once("SIGINT", () => graceful("SIGINT"))
    process.once("SIGTERM", () => graceful("SIGTERM"))

    return conn
}

export function getWhatsApp() {
    return singleton
}
