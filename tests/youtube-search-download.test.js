import assert from 'node:assert/strict'
import test from 'node:test'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import ffmpegPath from 'ffmpeg-static'
import { downloadYoutubeBySearch } from '../lib/youtube-search-download.js'
import mediaHandler from '../plugins/youtube-media-search.js'

test('yt-dlp search downloads the selected YouTube video locally and cleans up', async () => {
  const calls = []
  const result = await downloadYoutubeBySearch('Fairuz', {
    ensureBinary: async () => '/verified/yt-dlp',
    runCommand: async (binary, args) => {
      calls.push({ binary, args })
      if (calls.length === 1) {
        return { stdout: JSON.stringify({ title: 'Fairuz song', id: 'abcdefghijk', webpage_url: 'https://www.youtube.com/watch?v=abcdefghijk', duration: 120 }) }
      }
      const template = args[args.indexOf('-o') + 1]
      const file = template.replace('%(ext)s', 'mp4')
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, Buffer.from('video'))
      return { stdout: '' }
    },
  })
  assert.equal(result.title, 'Fairuz song')
  assert.equal(result.mimetype, 'video/mp4')
  assert.equal(calls[0].args.at(-1), 'ytsearch1:Fairuz')
  assert.ok(calls[1].args.includes('https://www.youtube.com/watch?v=abcdefghijk'))
  assert.ok(calls[1].args.includes('bestvideo[height<=240][ext=mp4]+worstaudio[ext=m4a]/bestvideo[height<=240]+worstaudio/best[height<=240][ext=mp4]/best[height<=240]/best'))
  assert.ok(calls[1].args.includes('--merge-output-format'))
  assert.equal(calls[1].args.includes('--ffmpeg-location'), Boolean(process.env.FFMPEG_PATH || (ffmpegPath && existsSync(ffmpegPath))))
  await access(result.filePath)
  await result.cleanup()
  await assert.rejects(access(result.filePath))
})

test('yt-dlp audio mode selects m4a audio and validates YouTube host', async () => {
  let callCount = 0
  const result = await downloadYoutubeBySearch('Fairuz', {
    audioOnly: true,
    ensureBinary: async () => '/verified/yt-dlp',
    runCommand: async (_binary, args) => {
      callCount += 1
      if (callCount === 1) return { stdout: JSON.stringify({ title: 'Song', id: 'abc', webpage_url: 'https://youtu.be/abc' }) }
      assert.ok(args.includes('bestaudio[ext=m4a]/bestaudio'))
      const template = args[args.indexOf('-o') + 1]
      const file = template.replace('%(ext)s', 'm4a')
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, Buffer.from('audio'))
      return { stdout: '' }
    },
  })
  assert.equal(result.audioOnly, true)
  assert.equal(result.mimetype, 'audio/mp4')
  await result.cleanup()
})

test('direct YouTube links are accepted and playback commands are renamed', async () => {
  const calls = []
  const result = await downloadYoutubeBySearch('https://youtu.be/abcdefghijk', {
    ensureBinary: async () => '/verified/yt-dlp',
    runCommand: async (_binary, args) => {
      calls.push(args)
      if (calls.length === 1) return { stdout: JSON.stringify({ title: 'Linked video', id: 'abcdefghijk', webpage_url: 'https://youtu.be/abcdefghijk' }) }
      const template = args[args.indexOf('-o') + 1]
      const file = template.replace('%(ext)s', 'mp4')
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, Buffer.from('video'))
      return { stdout: '' }
    },
  })
  assert.equal(calls[0].at(-1), 'https://youtu.be/abcdefghijk')
  assert.equal(mediaHandler.command.test('فيديو'), true)
  assert.equal(mediaHandler.command.test('اغنية'), true)
  assert.equal(mediaHandler.command.test('تشغيل'), false)
  assert.equal(mediaHandler.command.test('تشغيل_صوت'), false)
  await result.cleanup()
})

test('yt-dlp search rejects invalid queries, non-YouTube results, and overlong videos', async () => {
  await assert.rejects(downloadYoutubeBySearch('  ', { ensureBinary: async () => 'yt-dlp' }), /اكتب اسم/)
  await assert.rejects(downloadYoutubeBySearch('query', {
    ensureBinary: async () => 'yt-dlp',
    runCommand: async () => ({ stdout: JSON.stringify({ title: 'bad', webpage_url: 'https://example.org/video' }) }),
  }), /ليست رابط YouTube/)
  await assert.rejects(downloadYoutubeBySearch('query', {
    ensureBinary: async () => 'yt-dlp',
    runCommand: async () => ({ stdout: JSON.stringify({ title: 'long', webpage_url: 'https://youtu.be/abc', duration: 901 }) }),
  }), /تتجاوز 15 دقيقة/)
})
