import { chmod, createWriteStream, existsSync } from 'node:fs'
import { mkdtemp, readFile, rename, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import fetch from 'node-fetch'

const MAX_BINARY_BYTES = 50 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 60_000

function binaryName() {
  return process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
}

export function getYtDlpPath() {
  return process.env.YTDLP_PATH || join(process.cwd(), binaryName())
}

function downloadUrl() {
  const name = binaryName()
  const artifact = process.platform === 'darwin' ? 'yt-dlp_macos' : name
  return `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${artifact}`
}

function checksumUrl() {
  return 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS'
}

async function fetchWithTimeout(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'FLONA/2.0 yt-dlp updater' },
    })
  } finally {
    clearTimeout(timer)
  }
}

async function downloadVerified(destination) {
  const url = downloadUrl()
  const artifact = url.split('/').pop()
  const [binaryResponse, sumsResponse] = await Promise.all([
    fetchWithTimeout(url),
    fetchWithTimeout(checksumUrl()),
  ])
  if (!binaryResponse.ok) throw new Error(`فشل تحميل yt-dlp: HTTP ${binaryResponse.status}`)
  if (!sumsResponse.ok) throw new Error(`تعذر تحميل توقيع yt-dlp: HTTP ${sumsResponse.status}`)

  const sums = await sumsResponse.text()
  const expected = sums
    .split(/\r?\n/)
    .map(line => line.trim().split(/\s+/))
    .find(parts => parts.length >= 2 && parts[1].replace(/^\*+/, '') === artifact)?.[0]
  if (!expected || !/^[a-f0-9]{64}$/i.test(expected)) {
    throw new Error('تعذر العثور على SHA-256 المطابق لملف yt-dlp')
  }

  const length = Number(binaryResponse.headers.get('content-length') || 0)
  if (length > MAX_BINARY_BYTES) throw new Error('حجم yt-dlp أكبر من الحد الآمن')

  const directory = await mkdtemp(join(tmpdir(), 'flona-ytdlp-'))
  const temporary = join(directory, artifact)
  try {
    await pipeline(binaryResponse.body, createWriteStream(temporary, { flags: 'wx' }))
    const info = await stat(temporary)
    if (info.size === 0 || info.size > MAX_BINARY_BYTES) throw new Error('حجم yt-dlp غير صالح')
    const actual = createHash('sha256').update(await readFile(temporary)).digest('hex')
    if (actual.toLowerCase() !== expected.toLowerCase()) {
      throw new Error('فشل التحقق من SHA-256 لملف yt-dlp')
    }
    if (process.platform !== 'win32') await chmod(temporary, 0o755)
    await rename(temporary, destination)
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {})
  }
  return destination
}

export async function ensureYtDlp({ allowDownload = false } = {}) {
  const configured = getYtDlpPath()
  if (existsSync(configured)) return configured
  if (!allowDownload) {
    throw new Error('yt-dlp غير مثبت. ثبته أو حدّد YTDLP_PATH، ثم استخدم أمر التحديث الموثق.')
  }
  return downloadVerified(configured)
}

export async function updateYtDlp() {
  return downloadVerified(getYtDlpPath())
}
