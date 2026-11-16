import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyPlatformLink,
  createAtlasDownloadHandler,
  resolveAtlasMedia,
} from '../lib/atlas-platform-downloader.js'

const fixtures = [
  {
    platform: 'TikTok',
    link: 'https://www.tiktok.com/@sample/video/123',
    response: { code: 0, data: { play: 'https://cdn.example.test/tiktok.mp4' } },
    expectedType: 'video',
    expectedHost: 'tikwm.com',
  },
  {
    platform: 'Instagram',
    link: 'https://www.instagram.com/reel/abc/',
    response: { status: true, result: { metadata: { isVideo: true }, url: 'https://cdn.example.test/instagram.mp4' } },
    expectedType: 'video',
    expectedHost: 'api-faa.my.id',
  },
  {
    platform: 'Pinterest',
    link: 'https://pin.it/abc123',
    response: { status: true, result: { medias: [{ type: 'image', url: 'https://cdn.example.test/pinterest.jpg' }] } },
    expectedType: 'image',
    expectedHost: 'api-faa.my.id',
  },
  {
    platform: 'Facebook',
    link: 'https://www.facebook.com/watch/?v=123',
    response: { status: true, result: { media: { video_hd: 'https://cdn.example.test/facebook.mp4' } } },
    expectedType: 'video',
    expectedHost: 'api-faa.my.id',
  },
  {
    platform: 'X',
    link: 'https://x.com/sample/status/123',
    response: { status: true, result: { type: 'video', download_url: [{ type: 'mp4', resolusi: '768p', url: 'https://cdn.example.test/x.mp4' }] } },
    expectedType: 'video',
    expectedHost: 'api.nexray.web.id',
  },
  {
    platform: 'YouTube',
    link: 'https://youtu.be/abc123',
    response: { status: true, result: { title: 'Demo', download_url: 'https://cdn.example.test/youtube.mp4' } },
    expectedType: 'video',
    expectedHost: 'api-faa.my.id',
  },
]

test('تصنيف روابط المنصات الست المدعومة', () => {
  const expected = ['tiktok', 'instagram', 'pinterest', 'facebook', 'x', 'youtube']
  assert.deepEqual(fixtures.map(item => classifyPlatformLink(item.link).platform), expected)
})

test('معالجة استجابات API الوهمية لكل منصة مع التحقق من المضيف ونوع الوسائط', async t => {
  for (const fixture of fixtures) {
    await t.test(fixture.platform, async () => {
      let requestedUrl
      const httpGet = async url => {
        requestedUrl = new URL(url)
        return { data: fixture.response }
      }
      const items = await resolveAtlasMedia(fixture.link, { httpGet })
      assert.equal(requestedUrl.hostname, fixture.expectedHost)
      assert.equal(items[0].type, fixture.expectedType)
      assert.match(items[0].url, /^https:\/\//)
      assert.ok(items.length >= 1)
    })
  }
})

test('YouTube alias ytmp3_atlas يختار API الصوت ويرجع MP3', async () => {
  let requestedUrl
  const items = await resolveAtlasMedia('https://youtu.be/abc123', {
    command: 'ytmp3_atlas',
    httpGet: async url => {
      requestedUrl = new URL(url)
      return { data: { status: true, result: { title: 'Demo audio', mp3: 'https://cdn.example.test/audio.mp3' } } }
    },
  })
  assert.equal(requestedUrl.pathname, '/faa/ytmp3')
  assert.equal(items[0].type, 'audio')
  assert.equal(items[0].mimetype, 'audio/mpeg')
  assert.equal(items[0].fileName, 'Demo audio.mp3')
})

test('يرفض المضيف غير المدعوم، اختلاف xdl، وروابط وسائط داخلية', async () => {
  let requests = 0
  const httpGet = async () => { requests += 1; return { data: {} } }
  await assert.rejects(resolveAtlasMedia('https://example.org/post', { httpGet }), /الرابط غير مدعوم/)
  await assert.rejects(resolveAtlasMedia('https://instagram.com/p/abc', { command: 'xdl', httpGet }), /منصة X/)
  await assert.rejects(resolveAtlasMedia('https://youtu.be/abc', {
    httpGet: async () => ({ data: { status: true, result: { url: 'https://127.0.0.1/private.mp4' } } }),
  }), /رابط وسائط صالح/)
  assert.equal(requests, 0)
})

test('يتعامل مع فشل API دون إرسال وسائط', async () => {
  await assert.rejects(resolveAtlasMedia('https://youtu.be/abc', {
    httpGet: async () => ({ data: { status: false, message: 'mock failure' } }),
  }), /mock failure/)
})

test('تكامل الإضافة: يرسل وسائط X عبر sendMessage الوهمي', async () => {
  const sent = []
  const replies = []
  const m = { chat: 'test@s.whatsapp.net', key: { id: 'atlas-test' }, reply: async text => replies.push(text) }
  const conn = { sendMessage: async (...args) => { sent.push(args); return { key: { id: 'sent' } } } }
  const handler = createAtlasDownloadHandler({
    httpGet: async () => ({ data: { status: true, result: { type: 'video', download_url: [{ type: 'mp4', resolusi: '768p', url: 'https://cdn.example.test/clip.mp4' }] } } }),
  })

  const count = await handler(m, { conn, command: 'xdl', text: 'https://x.com/sample/status/123' })
  assert.equal(count, 1)
  assert.equal(sent.length, 1)
  assert.equal(sent[0][0], m.chat)
  assert.equal(sent[0][1].video.url, 'https://cdn.example.test/clip.mp4')
  assert.equal(sent[0][2].quoted, m)
  assert.deepEqual(replies, [])
})

test('تكامل الإضافة: يبلغ عن فشل الرابط للمستخدم', async () => {
  const replies = []
  const m = { chat: 'test@s.whatsapp.net', reply: async text => replies.push(text) }
  const handler = createAtlasDownloadHandler({ httpGet: async () => { throw new Error('offline mock') } })
  const count = await handler(m, {
    conn: { sendMessage: async () => assert.fail('لا يجب إرسال شيء عند الفشل') },
    command: 'atlasdl',
    text: 'https://youtu.be/abc',
  })
  assert.equal(count, 0)
  assert.deepEqual(replies, ['❌ offline mock'])
})
