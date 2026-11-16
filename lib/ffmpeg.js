import { spawn } from 'node:child_process'
import { isIP } from 'node:net'
import { FFMPEG_CONFIG } from './config.js'

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308])

function assertSafeRemoteUrl(raw) {
  let url
  try { url = new URL(raw) } catch { throw new Error('رابط الوسائط غير صالح') }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('يجب أن يكون رابط الوسائط HTTPS صالحاً')
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error('المضيف غير مسموح')
  if (isIP(host) === 4) {
    const [a,b] = host.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a >= 224) throw new Error('عنوان الشبكة غير مسموح')
  }
  if (isIP(host) === 6 && (/^(::1|fc|fd|fe80)/i.test(host))) throw new Error('عنوان الشبكة غير مسموح')
  return url
}

async function fetchBounded(rawUrl, maxBytes, timeoutMs = 30_000) {
  let url = assertSafeRemoteUrl(rawUrl)
  let response
  for (let redirects = 0; redirects <= FFMPEG_CONFIG.maxRedirects; redirects++) {
    response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'FLONA-BOT/2.0 media-fetch' } })
    if (!REDIRECT_CODES.has(response.status)) break
    const location = response.headers.get('location')
    if (!location || redirects === FFMPEG_CONFIG.maxRedirects) throw new Error('تجاوز رابط الوسائط عدد التحويلات المسموح')
    url = assertSafeRemoteUrl(new URL(location, url).href)
  }
  if (!response?.ok) throw new Error(`فشل جلب الوسائط (${response?.status || 'network'})`)
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new Error('حجم الوسائط أكبر من الحد المسموح')
  if (!response.body) throw new Error('استجابة الوسائط فارغة')
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel().catch(() => {})
        throw new Error('حجم الوسائط أكبر من الحد المسموح')
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock?.()
  }
  return Buffer.concat(chunks, size)
}

export async function downloadAudioBuffer(url, maxBytes = FFMPEG_CONFIG.maxInputBytes) {
  return fetchBounded(url, maxBytes)
}

function runFfmpeg(input, args) {
  return new Promise((resolve, reject) => {
    if (!Buffer.isBuffer(input) || input.length === 0) return reject(new Error('ملف الصوت فارغ'))
    if (input.length > FFMPEG_CONFIG.maxInputBytes) return reject(new Error('حجم الصوت أكبر من الحد المسموح'))
    let child
    try {
      child = spawn(FFMPEG_CONFIG.executable, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    } catch { return reject(new Error('تعذر تشغيل FFmpeg')) }
    const output = []
    let outputBytes = 0
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => child.kill('SIGKILL'), FFMPEG_CONFIG.timeoutMs)
    const finish = (error, buffer) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      error ? reject(error) : resolve(buffer)
    }
    child.stdout.on('data', chunk => {
      outputBytes += chunk.length
      if (outputBytes > FFMPEG_CONFIG.maxOutputBytes) {
        child.kill('SIGKILL')
        finish(new Error('ملف الصوت المحوّل تجاوز الحد المسموح'))
      } else output.push(chunk)
    })
    child.stderr.on('data', chunk => {
      if (stderr.length < 4000) stderr += chunk.toString('utf8').slice(0, 4000 - stderr.length)
    })
    child.once('error', () => finish(new Error('تعذر تشغيل FFmpeg؛ تحقق من تثبيته أو FFMPEG_PATH')))
    child.once('close', code => {
      if (settled) return
      if (code !== 0) return finish(new Error(`فشل تحويل الصوت عبر FFmpeg (${code ?? 'timeout'})`))
      const result = Buffer.concat(output, outputBytes)
      if (!result.length) return finish(new Error('لم ينتج FFmpeg ملفاً صوتياً'))
      finish(null, result)
    })
    child.stdin.on('error', () => {})
    child.stdin.end(input)
  })
}

export async function compressAudio(input) {
  return runFfmpeg(input, [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-i', 'pipe:0',
    '-vn', '-c:a', 'libopus', '-b:a', '128k', '-application', 'audio',
    '-f', 'ogg', 'pipe:1',
  ])
}
