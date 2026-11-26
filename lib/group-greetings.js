import { extractJidFromParam, isMentionableJid } from './identity.js'

export const DEFAULT_WELCOME_MESSAGE = '𓆩 🌷 نـوّرتـنـا 𓆪\n\nأهلاً وسهلاً بـ @العضو حلّيت بين أهلك وناسك، وزاد الجروب نورًا بقدومك ✨ يا مرحبا بمن جانا، وحيا الله من لفانا 🤍'
export const DEFAULT_GOODBYE_MESSAGE = '👋 وداعًا @العضو\n\nغادر الجروب وفّر علينا مساحة، وترك خلفه صمتًا جميلًا 😂 نتمنى له رحلة بلا عودة.. أقصد رحلة موفقة 🤣🖤'
export const DEFAULT_WELCOME_MESSAGES = [
  DEFAULT_WELCOME_MESSAGE,
  '🌷 يا مرحبا بـ @العضو! نورت الجروب، اعتبر نفسك بين أهلك… بس لا تنسى تسلّم علينا 😄🤍',
  '✨ وصل @العضو، واكتمل عدد الحبايب! حيّاك الله، عسى وجودك يضيف سوالف حلوة وضحكات أكثر 🌸',
  '𓆩 أهلًا بـ @العضو 𓆪\n\nحلّيت بين ناسك، والجروب زاد نور بقدومك. خذ راحتك… بس لا تراقب بصمت للأبد 😂🌷',
  '🎉 نورتنا يا @العضو! دخلت المكان الصح للسوالف والضحك… أما الهدوء فكان قبل ما توصل 😅🤍',
]
export const DEFAULT_GOODBYE_MESSAGES = [
  DEFAULT_GOODBYE_MESSAGE,
  '👋 مع السلامة يا @العضو… بنفتقدك؟ خلّينا ما نستعجل بالإجابة 😅 المجموعة هدت شوي بعد خروجك، رحلة سعيدة!',
  '🚪 طلع @العضو من الجروب… ما راح نعلن الحداد، بس بنسوي دقيقة صمت تقديرًا للهدوء الجديد 🤫😂',
  'وداعًا @العضو، اشتقنا للهدوء قبل لا تغادر… ونأمل تشتاق لنا، أو على الأقل لرسائلنا المفيدة 😌👋',
  'غادر @العضو… وانخفضت الرسائل المكررة بنسبة ممتازة! نمزح معك، بالتوفيق في رحلتك 🤣🖤',
]

function formatMessage(template, { mention, groupName, memberCount }) {
  return String(template)
    .replace(/@العضو|@user|\{user\}/g, mention)
    .replace(/\{group\}|@subject/g, groupName)
    .replace(/\{count\}/g, String(memberCount))
}

/** Send greetings from Baileys' authoritative group-participants.update event. */
export async function handleGroupParticipantsUpdate(conn, update, db = global.db, random = Math.random) {
  const action = String(update?.action || '').toLowerCase()
  const isJoin = action === 'add'
  const isExit = action === 'remove' || action === 'leave'
  if (!isJoin && !isExit) return 0

  let groupId = update?.id
  try { groupId = conn?.decodeJid?.(groupId) || groupId } catch {}
  if (typeof groupId !== 'string' || !groupId.endsWith('@g.us')) return 0

  const chatSettings = db?.data?.chats?.[groupId] || {}
  if (chatSettings.memberGreetingEnabled === false || chatSettings.welcome === false) return 0
  if (typeof conn?.sendMessage !== 'function') return 0

  const participants = Array.isArray(update?.participants) ? update.participants : []
  const targets = [...new Set(participants
    .map(extractJidFromParam)
    .filter(jid => jid && isMentionableJid(jid)))]
  if (!targets.length) return 0

  let metadata = null
  try { metadata = await conn.groupMetadata?.(groupId) || null } catch {}
  const groupName = String(metadata?.subject || chatSettings.subject || 'المجموعة')
  const memberCount = Number(metadata?.participants?.length || 0)
  const defaultMessages = isJoin ? DEFAULT_WELCOME_MESSAGES : DEFAULT_GOODBYE_MESSAGES
  const customTemplate = isJoin ? chatSettings.sWelcome : chatSettings.sBye
  const randomIndex = Math.min(defaultMessages.length - 1, Math.max(0, Math.floor(random() * defaultMessages.length)))
  const template = customTemplate || defaultMessages[randomIndex]

  let sent = 0
  for (const target of targets) {
    const mention = `@${target.split('@')[0]}`
    const text = formatMessage(template, { mention, groupName, memberCount })
    try {
      await conn.sendMessage(groupId, { text, mentions: [target] })
      sent++
    } catch (error) {
      console.error('[Group greeting] Failed to send message:', error?.message || error)
    }
  }
  return sent
}
