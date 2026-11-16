import test from 'node:test'
import assert from 'node:assert/strict'
import { findViewOnceMedia, getPrimaryOwnerJid, isViewOnceAutoEnabled } from '../lib/view-once.js'

test('finds image media wrapped in a ViewOnce message', () => {
  const image = { mimetype: 'image/jpeg', mediaKey: Buffer.from('key') }
  const result = findViewOnceMedia({
    viewOnceMessageV2: { message: { imageMessage: image } },
  })

  assert.equal(result.key, 'imageMessage')
  assert.equal(result.type, 'image')
  assert.equal(result.message, image)
})

test('finds nested video ViewOnce through transparent wrappers', () => {
  const video = { mimetype: 'video/mp4' }
  const result = findViewOnceMedia({
    ephemeralMessage: {
      message: {
        viewOnceMessageV2Extension: {
          message: { documentWithCaptionMessage: { message: { videoMessage: video } } },
        },
      },
    },
  })

  assert.equal(result.type, 'video')
  assert.equal(result.message, video)
})

test('accepts a media viewOnce flag and ignores ordinary media', () => {
  assert.equal(findViewOnceMedia({ imageMessage: { mimetype: 'image/jpeg' } }), null)
  assert.equal(findViewOnceMedia({ audioMessage: { viewOnce: true } }).type, 'audio')
})

test('selects only the first configured owner and normalizes its phone JID', () => {
  assert.equal(
    getPrimaryOwnerJid(['967700000001:12@s.whatsapp.net', '967700000002']),
    '967700000001@s.whatsapp.net',
  )
  assert.equal(getPrimaryOwnerJid(['123456789012@g.us']), null)
  assert.equal(getPrimaryOwnerJid([]), null)
})

test('automatic forwarding is on by default and can be explicitly disabled', () => {
  assert.equal(isViewOnceAutoEnabled(undefined), true)
  assert.equal(isViewOnceAutoEnabled(true), true)
  assert.equal(isViewOnceAutoEnabled(false), false)
  assert.equal(isViewOnceAutoEnabled('off'), false)
})
