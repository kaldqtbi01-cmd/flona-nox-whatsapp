const API_URL = 'https://lrclib.net/api/get'
const REQUEST_TIMEOUT_MS = 6000

export async function getLRCLyrics({ title, artist, duration, album } = {}) {
  if (!title || !artist) return null
  const url = new URL(API_URL)
  url.searchParams.set('track_name', String(title).slice(0, 200))
  url.searchParams.set('artist_name', String(artist).slice(0, 200))
  if (album) url.searchParams.set('album_name', String(album).slice(0, 200))
  const seconds = Number(duration)
  if (Number.isFinite(seconds) && seconds > 0) url.searchParams.set('duration', String(Math.round(seconds)))
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), headers: { accept: 'application/json' } })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export function parseSyncedLyrics(input) {
  if (typeof input !== 'string') return []
  const result = []
  const linePattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s*([^\r\n]*)/g
  for (const line of input.split(/\r?\n/)) {
    const matches = [...line.matchAll(linePattern)]
    for (const match of matches) {
      const fraction = match[3] ? Number(`0.${match[3]}`) : 0
      const time = Number(match[1]) * 60 + Number(match[2]) + fraction
      const text = String(match[4] || '').trim()
      if (text) result.push({ time, text })
    }
  }
  return result.sort((a, b) => a.time - b.time)
}

export function plainLyricsToSynced(input) {
  if (typeof input !== 'string') return []
  return input.split(/\r?\n/).map(text => text.trim()).filter(Boolean)
    .map((text, index) => ({ time: index * 4, text }))
}
