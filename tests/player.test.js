import test from 'node:test'
import assert from 'node:assert/strict'
import { createMusicPlayer } from '../lib/player.js'

test('escapes title, artist and lyric markup before embedding them into HTML', () => {
  const html = createMusicPlayer({
    title: '<script>alert(1)</script>',
    artist: 'Artist & Co',
    duration: '2:10',
    audioSrc: 'javascript:alert(1)',
    imageSrc: 'data:image/svg+xml;base64,PHN2Zz4=',
    lyrics: [{ time: 3, text: '<img src=x onerror=alert(1)>' }],
  })
  assert.doesNotMatch(html, /<script>|<img src=x onerror/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /&amp; Co/)
  assert.match(html, /المقطع الصوتي غير متاح/)
})

test('accepts bounded audio and raster image data URIs', () => {
  const html = createMusicPlayer({
    audioSrc: 'data:audio/ogg;base64,T2dnUw==',
    imageSrc: 'data:image/jpeg;base64,/9j/',
  })
  assert.match(html, /<audio controls/)
  assert.match(html, /<img class="cover"/)
})
