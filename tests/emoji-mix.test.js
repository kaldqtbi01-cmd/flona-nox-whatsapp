import test from 'node:test'
import assert from 'node:assert/strict'
import handler, { createEmojiStickerBuffer } from '../plugins/دمج-ايموجي.js'

function validWebp() {
  const output = Buffer.alloc(120)
  output.write('RIFF', 0, 'ascii')
  output.writeUInt32LE(output.length - 8, 4)
  output.write('WEBP', 8, 'ascii')
  output.write('VP8 ', 12, 'ascii')
  return output
}

test('downloads only the generated Gstatic PNG and converts it to a valid WebP sticker', async () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])
  const webp = validWebp()
  let requestedUrl = ''
  let conversionInput

  const output = await createEmojiStickerBuffer('😀', '🐱', {
    fetchImpl: async (url, options) => {
      requestedUrl = url
      assert.equal(options.redirect, 'error')
      return new Response(png, { headers: { 'content-type': 'image/png', 'content-length': String(png.length) } })
    },
    convert: async input => {
      conversionInput = input
      return webp
    },
  })

  const parsed = new URL(requestedUrl)
  assert.equal(parsed.hostname, 'www.gstatic.com')
  assert.ok(parsed.pathname.startsWith('/android/keyboard/emojikitchen/'))
  assert.deepEqual(conversionInput, png)
  assert.deepEqual(output, webp)
})

test('returns a friendly error for unsupported emoji and unavailable mix images', async () => {
  await assert.rejects(
    createEmojiStickerBuffer('A', 'B', { fetchImpl: async () => { throw new Error('must not fetch') } }),
    /تركيبة مدعومة/,
  )
  await assert.rejects(
    createEmojiStickerBuffer('😀', '🐱', {
      fetchImpl: async () => new Response('not found', { status: 404 }),
      convert: async () => validWebp(),
    }),
    /قد لا تكون هذه التركيبة متاحة/,
  )
})

test('rejects a converted file without a WebP signature', async () => {
  await assert.rejects(
    createEmojiStickerBuffer('😀', '🐱', {
      fetchImpl: async () => new Response(Buffer.from('png'), { headers: { 'content-type': 'image/png' } }),
      convert: async () => Buffer.from('not-webp'),
    }),
    /WebP/,
  )
})

test('emoji command rejects malformed input without network access', async () => {
  const replies = []
  const m = { chat: 'emoji-test@s.whatsapp.net', reply: async text => replies.push(text) }
  await handler(m, { conn: {}, text: '😀' })
  assert.match(replies[0], /إيموجيين/)
})
