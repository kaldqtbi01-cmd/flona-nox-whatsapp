import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { applyAudioEffect, compressAudio, downloadAudioBuffer } from '../lib/ffmpeg.js'

const hasFfmpeg = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0

test('rejects insecure URLs before making a network request', async () => {
  await assert.rejects(downloadAudioBuffer('http://example.org/audio.mp3'), /HTTPS/)
  await assert.rejects(downloadAudioBuffer('https://localhost/audio.mp3'), /مسموح/)
})

test('converts short WAV audio to bounded Ogg output', { skip: !hasFfmpeg }, async () => {
  const source = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.4', '-f', 'wav', 'pipe:1',
  ], { maxBuffer: 2 * 1024 * 1024 })
  assert.equal(source.status, 0)
  const encoded = await compressAudio(source.stdout)
  assert.ok(encoded.length > 0)
  assert.equal(encoded.subarray(0, 4).toString('ascii'), 'OggS')
})

test('applies only the supported audio effects to synthetic WAV input', { skip: !hasFfmpeg }, async () => {
  const source = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.4', '-f', 'wav', 'pipe:1',
  ], { maxBuffer: 2 * 1024 * 1024 })
  assert.equal(source.status, 0)

  for (const effect of ['fast', 'slow', 'deep', 'echo', 'reverse']) {
    const encoded = await applyAudioEffect(source.stdout, effect)
    assert.ok(encoded.length > 0, `${effect} should produce output`)
    assert.equal(encoded.subarray(0, 4).toString('ascii'), 'OggS', `${effect} should encode Ogg/Opus`)
  }
  await assert.rejects(applyAudioEffect(source.stdout, 'arbitrary-filter'), /غير معروف/)
})
