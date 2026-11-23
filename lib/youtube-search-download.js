import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureYtDlp } from './yt-dlp.js'
import ffmpegPath from 'ffmpeg-static'

const MAX_FILE_BYTES = 60 * 1024 * 1024
const MAX_DURATION_SECONDS = 15 * 60
const PROCESS_TIMEOUT_MS = 120_000
const MAX_SEARCH_RESULTS = 5

function run(binary, args, { timeoutMs = PROCESS_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error('انتهت مهلة الاتصال بـYouTube. جرّب مرة أخرى لاحقًا.'))
    }, timeoutMs)

    const append = (current, chunk) => (current + chunk.toString()).slice(-16_000)
    child.stdout.on('data', chunk => { stdout = append(stdout, chunk) })
    child.stderr.on('data', chunk => { stderr = append(stderr, chunk) })
    child.once('error', error => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(`تعذر تشغيل yt-dlp: ${error.message}`))
    })
    child.once('close', code => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code === 0) resolve({ stdout: stdout.trim(), stderr: stderr.trim() })
      else reject(new Error(stderr.trim().slice(-1000) || `yt-dlp انتهى برمز ${code}`))
    })
  })
}

function validateYoutubeUrl(raw) {
  let parsed
  try { parsed = new URL(raw) } catch { throw new Error('لم أجد نتيجة YouTube صالحة لهذا البحث.') }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
    throw new Error('نتيجة البحث ليست رابط YouTube صالحًا.')
  }
  return parsed.toString()
}

function pickEntry(entry) {
  const id = String(entry?.id || '').trim()
  const rawUrl = String(entry?.webpage_url || entry?.original_url || entry?.url || '').trim()
  let videoUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : ''
  if (!videoUrl) {
    const videoId = /^[\w-]{11}$/.test(id) ? id : (/^[\w-]{11}$/.test(rawUrl) ? rawUrl : '')
    if (videoId) videoUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
  }
  if (!videoUrl) throw new Error('لم أجد رابط فيديو صالحًا في نتيجة البحث.')
  videoUrl = validateYoutubeUrl(videoUrl)
  const duration = Number(entry?.duration)
  if (Number.isFinite(duration) && duration > MAX_DURATION_SECONDS) {
    throw new Error('مدة النتيجة تتجاوز 15 دقيقة؛ جرّب أغنية أو مقطعًا أقصر.')
  }
  return { url: videoUrl, title: String(entry?.title || 'نتيجة YouTube').slice(0, 160), duration }
}

function youtubeUrlOrSearch(term) {
  if (!/^https?:\/\//i.test(term)) return `ytsearch${MAX_SEARCH_RESULTS}:${term}`
  let parsed
  try { parsed = new URL(term) } catch { throw new Error('رابط YouTube غير صالح.') }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
    throw new Error('أرسل رابطًا من YouTube أو اكتب اسم المقطع للبحث.')
  }
  return parsed.toString()
}

function parseSearchResults(stdout) {
  let parsed
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error('لم أتمكن من قراءة نتائج البحث من YouTube؛ جرّب اسمًا آخر أو أرسل رابطًا مباشرًا.')
  }
  const entries = Array.isArray(parsed?.entries) ? parsed.entries.filter(Boolean) : [parsed]
  const candidates = []
  let lastError = null
  for (const entry of entries) {
    try { candidates.push(pickEntry(entry)) } catch (error) { lastError = error }
  }
  if (candidates.length) return candidates.slice(0, MAX_SEARCH_RESULTS)
  throw lastError || new Error('لم يتم العثور على نتائج مناسبة في YouTube.')
}

export async function downloadYoutubeBySearch(query, {
  audioOnly = false,
  ensureBinary = () => ensureYtDlp({ allowDownload: true }),
  runCommand = run,
  tempDirectory = tmpdir(),
} = {}) {
  const term = String(query || '').trim()
  if (!term) throw new Error('اكتب اسم الفيديو أو الأغنية بعد الأمر.')
  if (term.length > 200) throw new Error('عبارة البحث طويلة جدًا؛ اختصرها إلى 200 حرف أو أقل.')

  const binary = await ensureBinary()
  const source = youtubeUrlOrSearch(term)
  let candidates
  if (source.startsWith('ytsearch')) {
    const search = await runCommand(binary, [
      '--dump-single-json', '--skip-download', '--flat-playlist', '--playlist-end', String(MAX_SEARCH_RESULTS),
      '--no-warnings', '--no-progress', '--default-search', `ytsearch${MAX_SEARCH_RESULTS}`, source,
    ])
    candidates = parseSearchResults(search.stdout)
  } else {
    candidates = [{ url: validateYoutubeUrl(source), title: 'YouTube', duration: 0 }]
  }

  const dir = await mkdtemp(join(tempDirectory, 'flona-youtube-'))
  let lastError = null
  try {
    const ffmpegLocation = process.env.FFMPEG_PATH || (ffmpegPath && existsSync(ffmpegPath) ? ffmpegPath : null)
    for (const [index, selected] of candidates.entries()) {
      const outputTemplate = join(dir, `media-${index}.%(ext)s`)
      const args = [
        '--no-warnings', '--no-playlist', '--js-runtimes', 'node', '--socket-timeout', '30', '--retries', '1',
        '--match-filter', `duration <= ${MAX_DURATION_SECONDS}`,
        '--max-filesize', `${MAX_FILE_BYTES}`,
        '-o', outputTemplate,
      ]
      if (ffmpegLocation) args.push('--ffmpeg-location', ffmpegLocation)
      if (audioOnly) args.push('-f', 'bestaudio[ext=m4a]/bestaudio')
      else args.push(
        '-f',
        'bestvideo[height<=240][ext=mp4]+worstaudio[ext=m4a]/bestvideo[height<=240]+worstaudio/best[height<=240][ext=mp4]/best[height<=240]/best',
        '--merge-output-format', 'mp4',
      )
      args.push(selected.url)

      try {
        await runCommand(binary, args)
        const fileName = (await readdir(dir)).find(name => name.startsWith(`media-${index}.`))
        if (!fileName) throw new Error('انتهى التنزيل دون إنشاء ملف وسائط.')
        const filePath = join(dir, fileName)
        const fileInfo = await stat(filePath)
        if (!fileInfo.isFile() || fileInfo.size <= 0 || fileInfo.size > MAX_FILE_BYTES) {
          throw new Error('حجم الملف غير مناسب للإرسال (الحد الأقصى 60 ميغابايت).')
        }
        return {
          filePath,
          title: selected.title,
          size: fileInfo.size,
          audioOnly,
          mimetype: audioOnly ? 'audio/mp4' : 'video/mp4',
          cleanup: () => rm(dir, { recursive: true, force: true }),
        }
      } catch (error) {
        lastError = error
        const leftovers = await readdir(dir).catch(() => [])
        await Promise.all(leftovers.map(name => rm(join(dir, name), { recursive: true, force: true }).catch(() => {})))
      }
    }
    throw lastError || new Error('لم أتمكن من تنزيل أي نتيجة من YouTube.')
  } catch (error) {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}
