const theme = Object.freeze({
  build(parts = []) {
    if (!Array.isArray(parts)) return String(parts ?? '')
    return parts.map((part) => {
      if (typeof part === 'string' || typeof part === 'number') return String(part)
      if (!part || typeof part !== 'object') return ''
      const text = String(part.text ?? '')
      switch (part.type) {
        case 'title': return `╭─〔 ${text} 〕─╮`
        case 'subtitle': return `│ ${text}`
        case 'divider': return '├────────────────────'
        case 'info': return `│ ${part.label ? `${part.label}: ` : ''}${part.value ?? ''}`
        case 'line': return `│ ${text}`
        default: return text
      }
    }).filter(Boolean).join('\n')
  }
})

export { theme }
export default theme
