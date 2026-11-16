import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import QRCode from 'qrcode'
import { PDFDocument } from 'pdf-lib'

export const MAX_INPUT_BYTES = 24 * 1024 * 1024
export const MAX_OUTPUT_BYTES = 24 * 1024 * 1024
const FFMPEG_TIMEOUT_MS = 45_000

export async function getFfmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH
  try {
    const module = await import('ffmpeg-static')
    if (typeof module.default === 'string' && module.default) return module.default
  } catch {}
  return 'ffmpeg'
}

function assertBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('ملف الوسائط فارغ أو غير صالح')
  }
  if (buffer.length > MAX_INPUT_BYTES) {
    throw new Error('حجم الوسيط أكبر من الحد المسموح (24 MB)')
  }
}

export async function transcodeBuffer(buffer, {
  inputExt,
  outputExt,
  args = [],
  ffmpegPath,
  timeoutMs = FFMPEG_TIMEOUT_MS,
} = {}) {
  assertBuffer(buffer)
  if (!/^[a-z0-9]{2,5}$/i.test(inputExt || '') || !/^[a-z0-9]{2,5}$/i.test(outputExt || '')) {
    throw new Error('امتداد وسيط غير مدعوم')
  }

  const binary = ffmpegPath || await getFfmpegPath()
  const directory = await mkdtemp(join(tmpdir(), 'flona-convert-'))
  const inputPath = join(directory, `input.${inputExt}`)
  const outputPath = join(directory, `output.${outputExt}`)

  try {
    await writeFile(inputPath, buffer, { flag: 'wx' })
    const ffmpegArgs = [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', inputPath,
      ...args,
      '-fs', String(MAX_OUTPUT_BYTES),
      outputPath,
    ]

    await new Promise((resolve, reject) => {
      let stderr = ''
      let settled = false
      const child = spawn(binary, ffmpegArgs, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        child.kill('SIGKILL')
        reject(new Error('انتهت مهلة تحويل الوسائط'))
      }, timeoutMs)

      child.stderr.on('data', chunk => {
        if (stderr.length < 8_000) stderr += chunk.toString().slice(0, 8_000 - stderr.length)
      })
      child.once('error', error => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(new Error(`تعذر تشغيل FFmpeg: ${error.message}`))
      })
      child.once('close', code => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (code === 0) resolve()
        else reject(new Error(`فشل FFmpeg${stderr ? `: ${stderr.trim().slice(-1200)}` : ` (exit ${code})`}`))
      })
    })

    const outputInfo = await stat(outputPath)
    if (outputInfo.size === 0) throw new Error('أنتج التحويل ملفًا فارغًا')
    if (outputInfo.size >= MAX_OUTPUT_BYTES) throw new Error('الملف الناتج بلغ الحد الأقصى المسموح (24 MB)')
    return await readFile(outputPath)
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {})
  }
}

export async function imageToPng(buffer, inputExt, options = {}) {
  if (!['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(String(inputExt).toLowerCase())) {
    throw new Error('صيغة الصورة غير مدعومة للتحويل')
  }
  return transcodeBuffer(buffer, {
    inputExt: String(inputExt).toLowerCase(),
    outputExt: 'png',
    args: ['-frames:v', '1', '-an', '-c:v', 'png'],
    ...options,
  })
}

export async function webpToPng(buffer, options = {}) {
  return imageToPng(buffer, 'webp', options)
}

export async function audioOrVideoToMp3(buffer, inputExt, options = {}) {
  return transcodeBuffer(buffer, {
    inputExt,
    outputExt: 'mp3',
    args: ['-vn', '-t', '300', '-codec:a', 'libmp3lame', '-q:a', '3'],
    ...options,
  })
}

export async function imageToPdf(buffer) {
  assertBuffer(buffer)
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (!isJpeg && !isPng) throw new Error('الصورة الناتجة يجب أن تكون PNG أو JPEG')

  const pdf = await PDFDocument.create()
  const embedded = isJpeg ? await pdf.embedJpg(buffer) : await pdf.embedPng(buffer)
  const landscape = embedded.width > embedded.height
  const pageWidth = landscape ? 842 : 595
  const pageHeight = landscape ? 595 : 842
  const margin = 24
  const scale = Math.min((pageWidth - margin * 2) / embedded.width, (pageHeight - margin * 2) / embedded.height)
  const width = embedded.width * scale
  const height = embedded.height * scale
  const page = pdf.addPage([pageWidth, pageHeight])
  page.drawImage(embedded, {
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  })
  return Buffer.from(await pdf.save())
}

export async function textToQrPng(text) {
  const content = String(text || '').trim()
  if (!content) throw new Error('اكتب نصًا أو رابطًا بعد الأمر')
  if (content.length > 1_500) throw new Error('النص طويل جدًا لرمز QR (الحد 1500 حرف)')
  return QRCode.toBuffer(content, {
    type: 'png',
    width: 720,
    margin: 3,
    errorCorrectionLevel: 'M',
  })
}
