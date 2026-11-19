export function subBotNumber(value) {
  const local = String(value || '').split('@')[0].split(':')[0]
  return local.replace(/\D/g, '')
}

export function getSocketSubBotNumber(sock) {
  return [
    sock?.user?.jid,
    sock?.user?.id,
    sock?.authState?.creds?.me?.jid,
    sock?.authState?.creds?.me?.id,
  ].map(subBotNumber).find(Boolean) || ''
}

export function isSubBotSocketOpen(sock, number) {
  return Boolean(
    sock &&
    subBotNumber(number) &&
    getSocketSubBotNumber(sock) === subBotNumber(number) &&
    sock.ws?.isOpen === true
  )
}

export function hasOpenSubBot(connections, number) {
  return Array.isArray(connections) && connections.some(sock => isSubBotSocketOpen(sock, number))
}

export function isSubBotSocketActive(sock, number) {
  return Boolean(
    sock &&
    subBotNumber(number) &&
    getSocketSubBotNumber(sock) === subBotNumber(number) &&
    (sock.ws?.isOpen === true || sock.ws?.isConnecting === true)
  )
}

export function hasActiveSubBot(connections, number) {
  return Array.isArray(connections) && connections.some(sock => isSubBotSocketActive(sock, number))
}

export function getSubBotReconnectDelay(attempt, random = Math.random()) {
  const exponent = Math.min(9, Math.max(0, Math.floor(Number(attempt) || 0)))
  const base = Math.min(5 * 60_000, 1_000 * (2 ** exponent))
  const jitter = Math.floor(Math.max(0, Math.min(0.999999, Number(random) || 0)) * 1_000)
  return Math.min(5 * 60_000, base + jitter)
}
