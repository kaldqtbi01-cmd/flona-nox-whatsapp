const italicLatin = Object.freeze({
  a: '𝐴', b: '𝐵', c: '𝐶', d: '𝐷', e: '𝐸', f: '𝐹', g: '𝐺', h: '𝐻',
  i: '𝐼', j: '𝐽', k: '𝐾', l: '𝐿', m: '𝑀', n: '𝑁', o: '𝑂', p: '𝑃',
  q: '𝑄', r: '𝑅', s: '𝑆', t: '𝑇', u: '𝑈', v: '𝑉', w: '𝑊', x: '𝑋',
  y: '𝑌', z: '𝑍'
})

const handler = async (m, { text = '' }) => {
  const input = text.trim() || m.quoted?.text?.trim()
  if (!input) return m.reply('أرسل نصًا بعد الأمر أو استخدم الأمر ردًا على رسالة نصية.')

  const styled = [...input].map(char => italicLatin[char.toLowerCase()] || char).join('')
  return m.reply(styled)
}

handler.help = ['خط <نص> (أو رد على نص)']
handler.tags = ['tools']
handler.command = /^(خط|كيب)$/i

export default handler
