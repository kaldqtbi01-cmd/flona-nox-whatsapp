import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MENU_HELP_OVERRIDES,
  MENU_SECTIONS,
  getMenuCategories,
  getMenuCommands,
  normalizeMenuSection
} from '../lib/menu-categories.js'

test('legacy tags normalize to the ten canonical menu sections', () => {
  const aliases = {
    main: ['main', 'info'],
    owner: ['owner', 'serbot'],
    ai: ['ai'],
    anime: ['anime'],
    economy: ['economy', 'daily'],
    games: ['game', 'games', 'fun', 'ترفيه'],
    group: ['group', 'grupo', 'مجموعة', 'protection', 'nable'],
    download: ['download', 'downloader', 'internet', 'search'],
    media: ['sticker', 'image', 'editor'],
    tools: ['tools', 'herramientas', 'utils', 'قسم الأدوات🛠️', 'misc']
  }

  assert.equal(Object.keys(MENU_SECTIONS).length, 10)
  for (const [canonical, tags] of Object.entries(aliases)) {
    for (const tag of tags) assert.equal(normalizeMenuSection(tag), canonical, `${tag} → ${canonical}`)
    assert.equal(normalizeMenuSection(tagS(tags[0])), canonical)
  }
  assert.equal(normalizeMenuSection('unknown-tag'), null)
})

function tagS(value) {
  return value.toLocaleUpperCase()
}

test('commands from similar tags merge and duplicate labels appear once', () => {
  const plugins = {
    'first.js': { tags: ['game', 'games'], help: ['play', 'PLAY', 'guess'] },
    'second.js': { tags: ['grupo', 'protection'], help: ['warn'] },
    'disabled.js': { tags: ['games'], help: ['hidden'], disabled: true }
  }

  assert.deepEqual(getMenuCommands(plugins, 'games'), ['play', 'guess'])
  assert.deepEqual(getMenuCommands(plugins, 'group'), ['warn'])
  assert.deepEqual(getMenuCategories(plugins), ['games', 'group'])
})

test('the same command label is kept in only one section globally', () => {
  const plugins = {
    'first.js': { tags: ['tools'], help: ['status', 'status'] },
    'second.js': { tags: ['main'], help: ['STATUS'] }
  }

  assert.deepEqual(getMenuCommands(plugins, 'main'), [])
  assert.deepEqual(getMenuCommands(plugins, 'tools'), ['status'])
})

test('multi-purpose plugin commands route to one appropriate section each', () => {
  const plugins = {
    'yusef-features.js': {
      tags: ['fun', 'downloader', 'image'],
      help: ['مدح @منشن', 'شخصية @منشن', 'كرة8 <سؤال>', 'بحث_يوتيوب <كلمة>', 'صور_دول <الدولة>', 'جرأة']
    }
  }

  assert.deepEqual(getMenuCommands(plugins, 'games'), ['مدح @منشن', 'شخصية @منشن', 'كرة8 <سؤال>', 'جرأة'])
  assert.deepEqual(getMenuCommands(plugins, 'download'), ['بحث_يوتيوب <كلمة>'])
  assert.deepEqual(getMenuCommands(plugins, 'media'), ['صور_دول <الدولة>'])
  assert.deepEqual(getMenuCategories(plugins), ['games', 'download', 'media'])
  assert.equal(['games', 'download', 'media'].reduce((sum, section) => sum + getMenuCommands(plugins, section).length, 0), 6)
})

test('a newly supplied label is omitted when the same label already exists in that section', () => {
  const plugins = {
    '_stuts.js': { help: [] },
    'existing-status.js': { tags: ['main'], help: ['حالة'] }
  }

  assert.equal(getMenuCommands(plugins, 'main').filter(command => command === 'حالة').length, 1)
})

test('all newly exposed command labels have an explicit, complete section assignment', () => {
  const plugins = Object.fromEntries(
    Object.keys(MENU_HELP_OVERRIDES).map(filename => [filename, { help: [] }])
  )
  const expected = {
    main: 13,
    owner: 10,
    ai: 0,
    anime: 3,
    economy: 0,
    games: 8,
    group: 20,
    download: 4,
    media: 0,
    tools: 3
  }
  const actual = Object.fromEntries(
    Object.keys(MENU_SECTIONS).map(section => [section, getMenuCommands(plugins, section).length])
  )

  assert.deepEqual(actual, expected)
  assert.equal(Object.values(actual).reduce((sum, count) => sum + count, 0), 61)
  assert.equal(Object.hasOwn(MENU_HELP_OVERRIDES, 'Human ai.js'), false)
})
