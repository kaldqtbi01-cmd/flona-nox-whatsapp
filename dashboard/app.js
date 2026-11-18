const $ = (id) => document.getElementById(id)
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
const row = (label, value) => `<div class="row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`
function metric(label, value) { return `<div class="metric"><span>${esc(label)}</span><b>${esc(value)}</b></div>` }
async function refresh() {
  try {
    const response = await fetch('/api/overview', { cache: 'no-store' }); if (!response.ok) throw new Error('offline')
    const data = await response.json(); $('system-dot').classList.add('ok'); $('system-state').textContent = 'النظام متصل'; $('updated').textContent = `آخر تحديث: ${new Date(data.at).toLocaleTimeString('ar')}`
    $('metrics').innerHTML = [metric('الرسائل', data.features.messages), metric('الذكريات', data.features.memories), metric('مهام Nexus', Object.keys(data.nexus.tasks || {}).length), metric('الإضافات', data.plugins.count), metric('ذاكرة العملية', `${Math.round(data.process.memory / 1024 / 1024)} MB`)].join('')
    $('ai').innerHTML = row('Groq', data.ai.groqConfigured ? 'مضبوط' : 'غير مضبوط') + row('Gemini', data.ai.geminiConfigured ? 'مضبوط' : 'غير مضبوط') + row('التدقيق', data.features.audit)
    $('nexus').innerHTML = row('المهام', Object.keys(data.nexus.tasks || {}).length) + row('الشخصيات', Object.keys(data.nexus.personas || {}).length) + row('الأحداث', (data.nexus.events || []).length)
    $('security').innerHTML = row('الأحداث الأمنية', data.security.events) + row('الموافقات', data.features.approvals) + row('Workflows', data.features.workflows)
    $('whatsapp').innerHTML = row('Baileys', data.whatsapp.managedBy) + row('الجلسة', data.whatsapp.sessionUntouched ? 'لم تُمس' : 'تحقق مطلوب') + row('Uptime', `${data.process.uptime}s`)
  } catch { $('system-dot').classList.remove('ok'); $('system-state').textContent = 'غير متصل'; $('updated').textContent = 'تعذر قراءة Matrix API' }
}
refresh(); setInterval(refresh, 5000)
