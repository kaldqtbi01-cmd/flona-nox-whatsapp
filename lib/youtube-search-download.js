import { spawn } from 'node:child_process'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureYtDlp } from './yt-dlp.js'

const MAX_FILE_BYTES = 60 * 1024 * 1024
const MAX_DURATION_SECONDS = 15 * 60
const PROCESS_TIMEOUT_MS = 120_000

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

function pickEntry(info) {
  const entry = Array.isArray(info?.entries) ? info.entries.find(Boolean) : info
  const id = String(entry?.id || '').trim()
  const rawUrl = String(entry?.webpage_url || entry?.original_url || entry?.url || '').trim()
  const videoUrl = rawUrl || (id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : '')
  let parsed
  try { parsed = new URL(videoUrl) } catch { throw new Error('لم أجد نتيجة YouTube صالحة لهذا البحث.') }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
    throw new Error('نتيجة البحث ليست رابط YouTube صالحًا.')
  }
  const duration = Number(entry?.duration)
  if (Number.isFinite(duration) && duration > MAX_DURATION_SECONDS) {
    throw new Error('مدة النتيجة تتجاوز 15 دقيقة؛ جرّب أغنية أو مقطعًا أقصر.')
  }
  return { url: parsed.toString(), title: String(entry?.title || 'نتيجة YouTube').slice(0, 160), duration }
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
  const search = await runCommand(binary, [
    '--dump-single-json', '--skip-download', '--no-warnings', '--no-playlist',
    '--default-search', 'ytsearch1', `ytsearch1:${term}`,
  ])
  let info
  try { info = JSON.parse(search.stdout) } catch { throw new Error('لم أتمكن من قراءة نتيجة البحث من YouTube.') }
  const selected = pickEntry(info)
  const dir = await mkdtemp(join(tempDirectory, 'flona-youtube-'))
  const outputTemplate = join(dir, 'media.%(ext)s')

  try {
    const args = [
      '--no-warnings', '--no-playlist', '--socket-timeout', '30', '--retries', '2',
      '--match-filter', `duration <= ${MAX_DURATION_SECONDS}`,
      '--max-filesize', `${MAX_FILE_BYTES}`,
      '-o', outputTemplate,
    ]
    if (audioOnly) args.push('-f', 'bestaudio[ext=m4a]/bestaudio')
    else args.push('-f', 'best[height<=720][ext=mp4]/best[height<=720]/best', '--merge-output-format', 'mp4')
    args.push(selected.url)

    await runCommand(binary, args)
    const files = await readdir(dir)
    const fileName = files.find(name => name.startsWith('media.'))
    if (!fileName) throw new Error('انتهى التنزيل دون إنشاء ملف وسائط.')
    const filePath = join(dir, fileName)
    const info = await stat(filePath)
    if (!info.isFile() || info.size <= 0 || info.size > MAX_FILE_BYTES) {
      throw new Error('حجم الملف غير مناسب للإرسال (الحد الأقصى 60 ميغابايت).')
    }
    return {
      filePath,
      title: selected.title,
      size: info.size,
      audioOnly,
      mimetype: audioOnly ? 'audio/mp4' : 'video/mp4',
      cleanup: () => rm(dir, { recursive: true, force: true }),
    }
  } catch (error) {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}
