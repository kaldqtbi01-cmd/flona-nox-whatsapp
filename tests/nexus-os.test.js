import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createEventEngine, createRecoveryManager, scanPluginIntegrity, createAutonomousOS } from '../lib/nexus-os.js'

test('Event Engine يسجل المستمعين ويشغلهم', async () => {
  const events = createEventEngine(); let value = 0; events.on('x', ({ n }) => { value += n }); await events.emit('x', { n: 2 }); assert.equal(value, 2)
})

test('Recovery Manager يعيد المحاولة بحدود ثم ينجح', async () => {
  const recovery = createRecoveryManager({ maxAttempts: 2 }); let tries = 0
  const result = await recovery.run('service', async () => { tries++; if (tries < 2) throw new Error('temporary'); return 'ok' })
  assert.equal(result, 'ok'); assert.equal(tries, 2); assert.equal(recovery.status().service.status, 'healthy')
})

test('Plugin Integrity يكتشف التغيير والملف المفقود', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'flona-plugins-')); await fs.writeFile(path.join(dir, 'a.js'), 'a'); await fs.writeFile(path.join(dir, 'b.js'), 'b')
  const first = await scanPluginIntegrity(dir); await fs.writeFile(path.join(dir, 'a.js'), 'changed'); await fs.rm(path.join(dir, 'b.js'))
  const second = await scanPluginIntegrity(dir, first.entries); assert.deepEqual(second.changed, ['a.js']); assert.deepEqual(second.missing, ['b.js'])
})

test('Autonomous OS يدير مهمة عبر Nexus ويسجل الحالة', async () => {
  const events = []; const osEngine = createAutonomousOS({ core: {}, store: {}, security: {}, nexus: { runSwarm: async () => ({ summary: 'done', results: [] }) } })
  osEngine.events.on('task.completed', data => events.push(data.id))
  const result = await osEngine.submit({ scope: 'chat', owner: 'u', request: 'مهمة' })
  assert.equal(result.summary, 'done'); assert.equal(events.length, 1); assert.equal(osEngine.health().tasks[0].status, 'completed')
})
