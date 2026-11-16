export function awardGamePoint(db, chatJid, playerJid, points = 1) {
  if (!db?.data || !chatJid || !playerJid) throw new Error('لا يمكن تسجيل النقاط دون مجموعة ولاعب.')
  const amount = Number(points)
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('عدد النقاط يجب أن يكون عددًا صحيحًا موجبًا.')
  const chat = db.data.chats[chatJid] ||= {}
  const scores = chat.gameScores ||= {}
  const player = scores[playerJid] ||= { points: 0, wins: 0 }
  player.points = Number(player.points || 0) + amount
  player.wins = Number(player.wins || 0) + 1
  return { ...player }
}

export function getGameLeaderboard(db, chatJid, limit = 10) {
  const scores = db?.data?.chats?.[chatJid]?.gameScores || {}
  return Object.entries(scores)
    .map(([jid, score]) => ({ jid, points: Number(score?.points || 0), wins: Number(score?.wins || 0) }))
    .filter(player => Number.isFinite(player.points) && player.points > 0)
    .sort((a, b) => b.points - a.points || b.wins - a.wins || a.jid.localeCompare(b.jid))
    .slice(0, Math.max(1, Math.min(50, Number(limit) || 10)))
}
