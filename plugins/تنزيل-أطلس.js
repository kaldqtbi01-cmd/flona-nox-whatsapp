import { createAtlasDownloadHandler } from '../lib/atlas-platform-downloader.js'

const handler = createAtlasDownloadHandler()

handler.help = [
  'atlasdl <رابط TikTok/Instagram/Pinterest/Facebook/X/YouTube>',
  'xdl <رابط من X>',
  'pindl <رابط من Pinterest>',
  'تنزيل_صوت <رابط YouTube>',
]
handler.tags = ['download']
handler.command = /^(atlasdl|تنزيل_رابط|تنزيل_صوت|xdl|pindl|ytmp3_atlas)$/i

export default handler
