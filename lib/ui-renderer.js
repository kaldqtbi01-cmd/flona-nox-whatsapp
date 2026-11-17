export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
}

export function renderCard(title, body, meta = '') {
  return `<article class="flona-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p>${meta ? `<small>${escapeHtml(meta)}</small>` : ''}</article>`
}

export function renderList(items, empty = 'لا توجد نتائج') {
  if (!items?.length) return `<p>${escapeHtml(empty)}</p>`
  return `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

export function textFallback(title, items = []) {
  return [title, ...items.map(item => `• ${item}`)].join('\n')
}
