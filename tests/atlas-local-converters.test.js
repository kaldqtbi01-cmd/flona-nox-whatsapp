import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { before, after } from 'node:test'
import { PDFDocument } from 'pdf-lib'
import handler from '../plugins/محولات-محلية.js'
import {
  audioOrVideoToMp3,
  getFfmpegPath,
  imageToPdf,
  imageToPng,
  textToQrPng,
} from '../lib/atlas-local-converters.js'

let ffmpeg
let fixtureDir
let staticWebp
let wav
let jpeg

function run(binary, args) {
  return new Promise((resolve, reject) => {
    let stderr = ''
    const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-4000) })
    child.once('error', reject)
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`${binary} exited ${code}: ${stderr}`)))
  })
}

before(async () => {
  ffmpeg = await getFfmpegPath()
  fixtureDir = await mkdtemp(join(tmpdir(), 'flona-converter-tests-'))
  const staticPath = join(fixtureDir, 'still.webp')
  const wavPath = join(fixtureDir, 'tone.wav')
  const jpegPath = join(fixtureDir, 'photo.jpg')

  await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=80x60:d=1', '-frames:v', '1', '-c:v', 'libwebp', staticPath])
  await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=1', '-c:a', 'pcm_s16le', wavPath])
  await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=blue:s=100x80:d=1', '-frames:v', '1', '-q:v', '2', jpegPath])

  staticWebp = await readFile(staticPath)
  wav = await readFile(wavPath)
  jpeg = await readFile(jpegPath)
})

after(async () => {
  if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true })
})

test('QR: يصدر PNG صالحًا من نص محلي', async () => {
  const qr = await textToQrPng('https://example.test/flona')
  assert.ok(qr.length > 500)
  assert.deepEqual([...qr.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
})

test('WebP الثابت: يتحول إلى PNG', async () => {
  const png = await imageToPng(staticWebp, 'webp', { ffmpegPath: ffmpeg })
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.ok(png.length > 100)
})

test('الصوت: يتحول من WAV إلى MP3 قابل للقراءة', async () => {
  const mp3 = await audioOrVideoToMp3(wav, 'wav', { ffmpegPath: ffmpeg })
  assert.ok(mp3.length > 1_000)
  assert.ok(mp3.subarray(0, 3).equals(Buffer.from('ID3')) || (mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0))
})

test('الصورة: تصدر PDF بصفحة واحدة يمكن فتحها', async () => {
  const png = await imageToPng(jpeg, 'jpg', { ffmpegPath: ffmpeg })
  const pdfBytes = await imageToPdf(png)
  assert.equal(pdfBytes.toString('ascii', 0, 5), '%PDF-')
  const parsed = await PDFDocument.load(pdfBytes)
  assert.equal(parsed.getPageCount(), 1)
})

test('المدخلات غير الصالحة مرفوضة قبل التحويل', async () => {
  await assert.rejects(() => imageToPdf(Buffer.from('not an image')), /PNG أو JPEG/)
  await assert.rejects(() => textToQrPng('   '), /اكتب نصًا أو رابطًا/)
  await assert.rejects(() => imageToPng(Buffer.alloc(0), 'webp', { ffmpegPath: ffmpeg }), /فارغ أو غير صالح/)
})

test('تكامل الإضافة: toqr يرسل صورة ولا يعتمد على خدمة خارجية', async () => {
  const sent = []
  const replies = []
  const m = { chat: 'owner@s.whatsapp.net', key: { id: 'qr-test' }, reply: async text => replies.push(text) }
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload); return { key: {} } } }
  await handler(m, { conn, command: 'toqr', text: 'https://example.test' })
  const result = sent.find(payload => payload.image)
  assert.ok(result?.image)
  assert.deepEqual([...result.image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.deepEqual(replies, [])
})

test('تكامل الإضافة: topdf يرسل مستند PDF من صورة مقتبسة', async () => {
  const sent = []
  const replies = []
  const m = {
    chat: 'owner@s.whatsapp.net', key: { id: 'pdf-test' },
    quoted: { mimetype: 'image/jpeg', download: async () => jpeg },
    reply: async text => replies.push(text),
  }
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload); return { key: {} } } }
  await handler(m, { conn, command: 'topdf', text: '' })
  const result = sent.find(payload => payload.mimetype === 'application/pdf')
  assert.ok(result?.document)
  assert.equal((await PDFDocument.load(result.document)).getPageCount(), 1)
  assert.deepEqual(replies, [])
})

test('تكامل الإضافة: toimg يرسل PNG من ملصق WebP ثابت مقتبس', async () => {
  const sent = []
  const replies = []
  const m = {
    chat: 'owner@s.whatsapp.net', key: { id: 'image-test' },
    quoted: { mimetype: 'image/webp', download: async () => staticWebp },
    reply: async text => replies.push(text),
  }
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload); return { key: {} } } }
  await handler(m, { conn, command: 'toimg', text: '' })
  const result = sent.find(payload => payload.image)
  assert.ok(result?.image)
  assert.deepEqual([...result.image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.deepEqual(replies, [])
})

test('تكامل الإضافة: toaudio يرسل MP3 من صوت مقتبس', async () => {
  const sent = []
  const replies = []
  const m = {
    chat: 'owner@s.whatsapp.net', key: { id: 'audio-test' },
    quoted: { mimetype: 'audio/wav', download: async () => wav },
    reply: async text => replies.push(text),
  }
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload); return { key: {} } } }
  await handler(m, { conn, command: 'toaudio', text: '' })
  const result = sent.find(payload => payload.mimetype === 'audio/mpeg')
  assert.ok(result?.audio)
  assert.ok(result.audio.subarray(0, 3).equals(Buffer.from('ID3')) || (result.audio[0] === 0xff && (result.audio[1] & 0xe0) === 0xe0))
  assert.deepEqual(replies, [])
})

test('تكامل الإضافة: tomp3 يرسل ملف MP3 كمستند', async () => {
  const sent = []
  const replies = []
  const m = {
    chat: 'owner@s.whatsapp.net', key: { id: 'mp3-test' },
    quoted: { mimetype: 'audio/wav', download: async () => wav },
    reply: async text => replies.push(text),
  }
  const conn = { sendMessage: async (_chat, payload) => { sent.push(payload); return { key: {} } } }
  await handler(m, { conn, command: 'tomp3', text: '' })
  const result = sent.find(payload => payload.mimetype === 'audio/mpeg')
  assert.ok(result?.document)
  assert.equal(result.fileName, 'flona-converted.mp3')
  assert.deepEqual(replies, [])
})
