// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  📢 منشن جماعي للمجموعات
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const GIF_URL = "https://files.catbox.moe/56k4ua.mp4"
const PRIVATE_FLOW_TTL_MS = 5 * 60 * 1000
const PRIVATE_MENTION_FLOWS = new Map()

function memberIds(metadata) {
    return [...new Set((metadata?.participants || []).map(p => p.id || p.jid).filter(Boolean))]
}

function formatMentionText(message, groupName, members, botName = global.botName || "𝐂𝐇𝐄𝐎𝐍 𝐁𝐎𝐓") {
    const now = new Date()
    const date = now.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })
    const time = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
    return [
        `🟢🟢🟢 *منشن جماعي* 🟢🟢🟢`,
        "",
        `📢 ${message}`,
        `🛡️ المجموعة: *${groupName || "المجموعة"}*`,
        `👥 عدد الأعضاء: *${members.length}*`,
        `🗓️ التاريخ: ${date}`,
        `🕐 الوقت: ${time}`,
        "",
        "―".repeat(20),
        "💬 منشن فعلي لجميع الأعضاء",
        "",
        members.map(id => `⚡ @${id.split("@")[0].split(":")[0]}`).join("\n"),
        "",
        `> 🤖 ${botName}`,
    ].join("\n")
}

async function reply(m, conn, text) {
    return conn.sendMessage(m.chat, { text }, { quoted: m })
}

async function getFreshMetadata(conn, groupId) {
    if (typeof conn.groupMetadata !== "function") throw new Error("تعذر جلب بيانات المجموعة")
    return conn.groupMetadata(groupId, false)
}

async function handlePrivateCommand(m, { conn, command, args = [], isROwner }) {
    if (!isROwner) return reply(m, conn, "❌ هذا الأمر للمطوّر الرئيسي فقط")
    const cmd = String(command || "").toLowerCase()
    const ownerId = String(m.sender || m.chat)
    const flow = PRIVATE_MENTION_FLOWS.get(ownerId)
    if (flow && Date.now() - flow.createdAt > PRIVATE_FLOW_TTL_MS) PRIVATE_MENTION_FLOWS.delete(ownerId)

    if (cmd === "الغاء_منشن") {
        PRIVATE_MENTION_FLOWS.delete(ownerId)
        return reply(m, conn, "تم إلغاء المنشن الجماعي.")
    }

    if (cmd === "اختيار_منشن") {
        const current = PRIVATE_MENTION_FLOWS.get(ownerId)
        if (!current || current.step !== "choose") return reply(m, conn, "لا توجد قائمة مجموعات نشطة. ابدأ من جديد بأمر: .منشن <رسالتك>")
        const choice = Number(String(args[0] || "").trim())
        if (!Number.isInteger(choice) || choice < 1 || choice > current.groups.length) {
            return reply(m, conn, `اختر رقمًا من 1 إلى ${current.groups.length}.`)
        }
        const selected = current.groups[choice - 1]
        let metadata
        try {
            metadata = await getFreshMetadata(conn, selected.id)
        } catch {
            return reply(m, conn, "تعذر تحديث بيانات هذه المجموعة. أعد طلب القائمة وحاول مرة أخرى.")
        }
        const members = memberIds(metadata)
        if (!members.length) return reply(m, conn, "لم أتمكن من جلب أعضاء المجموعة؛ لم يُرسل أي منشن.")
        current.step = "confirm"
        current.group = { id: selected.id, subject: metadata.subject || selected.subject || "المجموعة" }
        current.memberCount = members.length
        PRIVATE_MENTION_FLOWS.set(ownerId, current)
        return reply(m, conn,
            `معاينة الإرسال إلى: *${current.group.subject}*\nعدد الأعضاء: ${members.length}\n\nالرسالة:\n${current.message}\n\nإذا كان الاختيار صحيحًا أرسل: .تأكيد_منشن\nللإلغاء أرسل: .الغاء_منشن`)
    }

    if (cmd === "تأكيد_منشن") {
        const current = PRIVATE_MENTION_FLOWS.get(ownerId)
        if (!current || current.step !== "confirm") return reply(m, conn, "لا توجد معاينة جاهزة للتأكيد. ابدأ بأمر: .منشن <رسالتك>")
        let metadata
        try {
            metadata = await getFreshMetadata(conn, current.group.id)
        } catch {
            PRIVATE_MENTION_FLOWS.delete(ownerId)
            return reply(m, conn, "تعذر تحديث بيانات المجموعة؛ ألغيت الإرسال احتياطًا.")
        }
        const members = memberIds(metadata)
        if (!members.length) {
            PRIVATE_MENTION_FLOWS.delete(ownerId)
            return reply(m, conn, "لا يوجد أعضاء متاحون للمنشن؛ ألغيت الإرسال.")
        }
        const text = formatMentionText(current.message, metadata.subject || current.group.subject, members)
        try {
            await conn.sendMessage(current.group.id, {
                text,
                mentions: members,
                contextInfo: { mentionedJid: members },
            })
            PRIVATE_MENTION_FLOWS.delete(ownerId)
            return reply(m, conn, `✅ تم إرسال المنشن إلى *${metadata.subject || current.group.subject}* (${members.length} عضوًا).`)
        } catch (error) {
            return reply(m, conn, `❌ فشل الإرسال ولم ألغِ المعاينة؛ يمكنك المحاولة مجددًا. ${String(error?.message || "").slice(0, 180)}`)
        }
    }

    if (cmd !== "منشن" && cmd !== "تاق_الكل" && cmd !== "تاقالكل" && cmd !== "tagall" && cmd !== "تاق" && cmd !== "هيدرا" && cmd !== "mentionall") {
        return reply(m, conn, "استخدم .منشن <رسالتك> لبدء الإرسال إلى مجموعة.")
    }
    const message = args.join(" ").trim()
    if (!message) return reply(m, conn, "اكتب الرسالة أولًا. مثال: .منشن جمعة مباركة للجميع")
    if (typeof conn.groupFetchAllParticipating !== "function") {
        return reply(m, conn, "❌ لا أستطيع جلب قائمة المجموعات من هذا الاتصال.")
    }

    let participating
    try {
        participating = await conn.groupFetchAllParticipating()
    } catch {
        return reply(m, conn, "❌ تعذر جلب مجموعات البوت الآن؛ حاول مرة أخرى لاحقًا.")
    }
    const groups = Object.entries(participating || {})
        .filter(([id, metadata]) => id.endsWith("@g.us") && metadata)
        .map(([id, metadata]) => ({ id, subject: metadata.subject || id, size: metadata.participants?.length || 0 }))
        .sort((a, b) => a.subject.localeCompare(b.subject, "ar"))
    if (!groups.length) return reply(m, conn, "لا توجد مجموعات متاحة أرسل إليها المنشن.")

    PRIVATE_MENTION_FLOWS.set(ownerId, { step: "choose", message, groups, createdAt: Date.now() })
    const list = groups.map((group, index) => `${index + 1}. ${group.subject} — ${group.size} عضوًا`).join("\n")
    return reply(m, conn,
        `اختر المجموعة المستهدفة بإرسال رقمها: `.concat(`\n${list}\n\nاكتب مثلًا: .اختيار_منشن 2\nتنتهي صلاحية الاختيار بعد 5 دقائق. لن يُرسل شيء قبل التأكيد.`))
}

async function handleGroupCommand(m, { conn, participants = [], groupMetadata, args = [], isROwner }) {
    const react = async emoji => {
        try { await conn.sendMessage(m.chat, { react: { text: emoji, key: m.key } }) } catch {}
    }
    if (!isROwner) return m.reply("❌ للمطوّر الرئيسي فقط")
    await react("⏳")

    const botName = global.botName || "𝐂𝐇𝐄𝐎𝐍 𝐁𝐎𝐓"
    const groupName = groupMetadata?.subject || "المجموعة"
    const members = memberIds({ participants })

    const isReply = !!(m.quoted || m.msg?.contextInfo?.quotedMessage)
    if (isReply) {
        await react("📨")
        try {
            const quotedMessage = m.quoted?.vM || m.quoted?.fakeObj
            if (quotedMessage) {
                await conn.sendMessage(m.chat, {
                    forward: quotedMessage,
                    mentions: members,
                    contextInfo: { mentionedJid: members },
                })
            } else {
                const text = `📨 *رسالة للجميع*\n\n${members.map(id => `⚡ @${id.split("@")[0].split(":")[0]}`).join("\n")}\n\n> 🤖 ${botName}`
                await conn.sendMessage(m.chat, { text, mentions: members }, { quoted: m })
            }
        } catch (error) {
            console.error("منشن مع رد:", error.message)
            await react("❌")
            return m.reply("❌ فشل إرسال المنشن مع الرد")
        }
        return react("✅")
    }

    const message = args.join(" ").trim() || "📢 منشن جماعي لكل الأعضاء!"
    const text = formatMentionText(message, groupName, members, botName)
    try {
        await conn.sendMessage(m.chat, {
            video: { url: GIF_URL },
            caption: text,
            mentions: members,
            gifPlayback: true,
            contextInfo: { mentionedJid: members },
        }, { quoted: m })
        await react("📢")
    } catch {
        try {
            await conn.sendMessage(m.chat, { text, mentions: members, contextInfo: { mentionedJid: members } }, { quoted: m })
            await react("📢")
        } catch (error) {
            console.error("منشن:", error.message)
            await react("❌")
            m.reply("❌ فشل الإرسال: " + error.message)
        }
    }
}

let handler = async (m, ctx) => {
    if (!m.isGroup) return handlePrivateCommand(m, ctx)
    const command = String(ctx.command || "").toLowerCase()
    if (["اختيار_منشن", "تأكيد_منشن", "الغاء_منشن"].includes(command)) {
        return m.reply("نفّذ خطوات اختيار المجموعة والتأكيد في الخاص مع البوت.")
    }
    return handleGroupCommand(m, ctx)
}

handler.help = ["منشن <رسالة>"]
handler.tags = ["group"]
handler.command = /^(تاق_الكل|تاقالكل|tagall|تاق|منشن|هيدرا|mentionall|اختيار_منشن|تأكيد_منشن|الغاء_منشن)$/i
handler.group = false
handler.admin = false
handler.rowner = true

export default handler
