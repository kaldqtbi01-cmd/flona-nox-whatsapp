export const MENU_SECTIONS = Object.freeze({
  main: Object.freeze({ title: 'الرئيسية والمعلومات', icon: '🌷' }),
  owner: Object.freeze({ title: 'إدارة البوت والمطور', icon: '👑' }),
  ai: Object.freeze({ title: 'الذكاء الاصطناعي', icon: '🪄' }),
  anime: Object.freeze({ title: 'الأنمي والمانجا', icon: '🌸' }),
  economy: Object.freeze({ title: 'الاقتصاد واليوميات', icon: '💎' }),
  games: Object.freeze({ title: 'الألعاب والترفيه', icon: '🎀' }),
  group: Object.freeze({ title: 'المجموعات والحماية', icon: '🛡️' }),
  download: Object.freeze({ title: 'التنزيل والإنترنت', icon: '📥' }),
  media: Object.freeze({ title: 'الصور والملصقات', icon: '🦋' }),
  tools: Object.freeze({ title: 'الأدوات والخدمات', icon: '✨' })
})

const TAG_ALIASES = Object.freeze({
  main: 'main',
  info: 'main',
  owner: 'owner',
  serbot: 'owner',
  ai: 'ai',
  misc: 'tools',
  anime: 'anime',
  economy: 'economy',
  daily: 'economy',
  game: 'games',
  games: 'games',
  fun: 'games',
  'ترفيه': 'games',
  group: 'group',
  grupo: 'group',
  'مجموعة': 'group',
  protection: 'group',
  download: 'download',
  downloader: 'download',
  internet: 'download',
  search: 'download',
  sticker: 'media',
  image: 'media',
  editor: 'media',
  tools: 'tools',
  herramientas: 'tools',
  utils: 'tools',
  'قسم الأدوات🛠️': 'tools',
  nable: 'group'
})

// These commands had executable handlers but no help labels, so they were
// omitted from the previous menu. Labels preserve the existing command syntax.
export const MENU_HELP_OVERRIDES = Object.freeze({
  'FEN-chess.js': ['fen', 'فن', 'شطرنج', 'فحص_شطرنج'],
  'FKmsg.js': ['فيك [النص البديل] (بالرد على الرسالة)'],
  '_stuts.js': ['status', 'report', 'estado', 'informe', 'الحاله', 'حاله', 'حالة', 'الحالة', 'تقرير', 'ريبورت', 'احصائيات', 'إحصائيات', 'معلومات', 'ستاتس'],
  'apk.js': ['apk <اسم التطبيق>'],
  'debug.js': ['debugbtn', 'تصحيح'],
  'dmsg.js': ['dmsg', 'حذف (بالرد على الرسالة)', 'مسح (بالرد على الرسالة)'],
  'jadbots.js': ['jadibot', 'serbot', 'rentbot', 'تنصيب [رقم الحساب]'],
  'manga-chapters.js': ['مانجاتك <اسم المانجا>'],
  'remote-transmission.js': ['الجروبات', 'جروباتي', 'ارسل_للجروب <رقم الجروب> <الرسالة أو الأمر>', 'وجه <رقم الجروب> <الرسالة أو الأمر>'],
  'skygame.js': ['skygame', 'sky'],
  'virustotal.js': ['فحص <رابط أو رد على ملف>', 'vt <رابط أو رد على ملف>', 'virustotal <رابط أو رد على ملف>'],
  'ايديت-تيك.js': ['ايديت <كلمة البحث>', 'بحث-تيك <كلمة البحث>', 'tiktoksearch <كلمة البحث>'],
  'تست.js': ['تست', 'test'],
  'شس.js': ['chess', 'شس'],
  'مانع-جهات.js': ['مضاد_الجهات on', 'مضاد_الجهات off', 'مضاد_جهات on', 'مضاد_جهات off', 'anticontact on', 'anticontact off', 'anti-contact on', 'anti-contact off'],
  'مضاد_البوتات.js': ['مضاد_البوتات on', 'مضاد_البوتات off', 'antibot on', 'antibot off', 'نوبوت on', 'نوبوت off', 'مضاد on', 'مضاد off']
})

// Explicit routing prevents a multi-tag plugin from duplicating one command
// across sections, and moves section-shortcut commands beside their destination.
const PLUGIN_SECTION_OVERRIDES = Object.freeze({
  'FEN-chess.js': 'games',
  'FKmsg.js': 'owner',
  '_stuts.js': 'main',
  'apk.js': 'download',
  'debug.js': 'owner',
  'dmsg.js': 'owner',
  'jadbots.js': 'owner',
  'manga-chapters.js': 'anime',
  'remote-transmission.js': 'group',
  'skygame.js': 'games',
  'virustotal.js': 'tools',
  'ايديت-تيك.js': 'download',
  'تست.js': 'anime',
  'شس.js': 'games',
  'مانع-جهات.js': 'group',
  'مضاد_البوتات.js': 'group',
  '_on.js': 'group',
  'Improve-quality.js': 'media',
  'sticker-emo.js': 'media',
  'RGB.js': 'tools',
  'قسم_الالعاب.js': 'games',
  'قسم_البنك.js': 'economy',
  'قسم_التحميلات.js': 'download',
  'قسم_الحماية.js': 'group',
  'قسم_الذكاء.js': 'ai',
  'قسم_الصور.js': 'media',
  'قسم_المجموعات.js': 'group'
})

const COMMAND_SECTION_OVERRIDES = Object.freeze({
  'yusef-features.js': Object.freeze({
    'مدح @منشن': 'games',
    'شخصية @منشن': 'games',
    'كرة8 <سؤال>': 'games',
    'بحث_يوتيوب <كلمة>': 'download',
    'صور_دول <الدولة>': 'media',
    'جرأة': 'games'
  }),
  'الميزات-النادرة.js': Object.freeze({
    'حالة_الميزات': 'tools',
    'سياق': 'ai',
    'سجل_التدقيق': 'owner',
    'مراجعة': 'owner',
    'موافقة': 'owner',
    'رفض': 'owner',
    'تعديل_الرد': 'owner',
    'دفاع': 'group'
  })
})

function pluginFilename(key) {
  return String(key).split(/[\\/]/).at(-1)
}

function normalizeLabel(label) {
  return String(label || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function normalizeMenuSection(rawTag) {
  if (typeof rawTag !== 'string') return null
  const tag = rawTag.trim().toLocaleLowerCase()
  return TAG_ALIASES[tag] || null
}

function getPluginHelp(filename, plugin) {
  const labels = MENU_HELP_OVERRIDES[filename] ?? plugin?.help
  if (Array.isArray(labels)) return labels.filter(label => typeof label === 'string' && label.trim())
  return typeof labels === 'string' && labels.trim() ? [labels] : []
}

function getCommandSection(filename, plugin, label) {
  const commandOverrides = COMMAND_SECTION_OVERRIDES[filename]
  if (commandOverrides) {
    const key = normalizeLabel(label)
    const match = Object.entries(commandOverrides).find(([command]) => normalizeLabel(command) === key)
    if (match) return match[1]
  }

  if (PLUGIN_SECTION_OVERRIDES[filename]) return PLUGIN_SECTION_OVERRIDES[filename]

  const tags = Array.isArray(plugin?.tags) ? plugin.tags : [plugin?.tags]
  for (const tag of tags) {
    const section = normalizeMenuSection(tag)
    if (section) return section
  }
  return null
}

export function getMenuCommands(plugins, section) {
  if (!MENU_SECTIONS[section]) return []

  const commands = []
  const seen = new Set()
  const entries = Object.entries(plugins || {}).sort(([left], [right]) => left.localeCompare(right))

  for (const [key, plugin] of entries) {
    if (!plugin || plugin.disabled) continue
    const filename = pluginFilename(key)
    for (const label of getPluginHelp(filename, plugin)) {
      if (getCommandSection(filename, plugin, label) !== section) continue
      const normalized = normalizeLabel(label)
      if (!normalized || seen.has(normalized)) continue
      seen.add(normalized)
      commands.push(label.trim().replace(/\s+/g, ' '))
    }
  }

  return commands
}

export function getMenuCategories(plugins) {
  return Object.keys(MENU_SECTIONS).filter(section => getMenuCommands(plugins, section).length > 0)
}
