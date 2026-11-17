export function createChatQueue(options = {}) {
  const queues = new Map()
  const maxDepth = options.maxDepth || 20
  async function run(chatId, task) {
    const state = queues.get(chatId) || { tail: Promise.resolve(), depth: 0, controller: null }
    if (state.depth >= maxDepth) throw new Error('queue depth exceeded')
    state.depth++
    const controller = new AbortController()
    state.controller = controller
    const previous = state.tail
    const current = previous.catch(() => {}).then(() => task({ signal: controller.signal }))
    state.tail = current.finally(() => {
      state.depth--
      if (state.depth <= 0) queues.delete(chatId)
    })
    queues.set(chatId, state)
    return current
  }
  function cancel(chatId, reason = 'cancelled') {
    const state = queues.get(chatId)
    if (!state) return false
    state.controller?.abort(reason)
    return true
  }
  function stats(chatId) {
    const state = queues.get(chatId)
    return { depth: state?.depth || 0, active: Boolean(state) }
  }
  return { run, cancel, stats }
}
