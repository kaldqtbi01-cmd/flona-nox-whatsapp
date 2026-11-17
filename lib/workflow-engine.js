const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor'])

export function getPath(object, path) {
  if (!path) return object
  return String(path).split('.').reduce((value, key) => FORBIDDEN.has(key) ? undefined : value?.[key], object)
}

export function renderTemplate(text, context, max = 4000) {
  const output = String(text ?? '').replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, path) => {
    const value = getPath(context, path.trim())
    return value === undefined || value === null ? '' : String(value)
  })
  return output.slice(0, max)
}

export function validateWorkflow(flow) {
  if (!flow || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) throw new Error('invalid workflow')
  const ids = new Set(flow.nodes.map(node => node.id))
  if (ids.size !== flow.nodes.length || [...ids].some(id => !id)) throw new Error('invalid node ids')
  for (const edge of flow.edges) if (!ids.has(edge.source) || !ids.has(edge.target)) throw new Error('invalid edge')
  return true
}

export async function runWorkflow(flow, input = {}, options = {}) {
  validateWorkflow(flow)
  const nodes = new Map(flow.nodes.map(node => [node.id, node]))
  const edges = flow.edges
  const ctx = { ...input, variables: { ...(input.variables || {}) } }
  let current = flow.startNode || flow.nodes[0]?.id
  let steps = 0
  const maxSteps = Math.min(100, options.maxSteps || 50)
  const started = Date.now()
  const logs = []
  while (current && steps++ < maxSteps) {
    if (Date.now() - started > (options.timeoutMs || 10000)) throw new Error('workflow timeout')
    if (options.signal?.aborted) throw new Error('workflow cancelled')
    const node = nodes.get(current)
    if (!node) throw new Error(`unknown node ${current}`)
    const value = node.data?.value
    if (node.type === 'set-variable') ctx.variables[node.data?.name] = renderTemplate(value, ctx)
    else if (node.type === 'format') ctx.output = renderTemplate(value, ctx)
    else if (node.type === 'condition') {
      const left = getPath(ctx, node.data?.path)
      const right = node.data?.value
      const ok = node.data?.operator === 'equals' ? String(left) === String(right) : Boolean(left)
      current = edges.find(edge => edge.source === node.id && edge.sourceHandle === (ok ? 'true' : 'false'))?.target
      logs.push({ node: node.id, result: ok })
      continue
    } else if (node.type === 'delay') await new Promise((resolve, reject) => { const timer = setTimeout(resolve, Math.min(30000, Number(node.data?.ms || 0))); options.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('workflow cancelled')) }, { once: true }) })
    else if (!['start', 'end'].includes(node.type)) throw new Error(`unsupported node ${node.type}`)
    logs.push({ node: node.id, type: node.type })
    current = edges.find(edge => edge.source === node.id)?.target
  }
  if (steps >= maxSteps) throw new Error('workflow step limit')
  return { context: ctx, logs, steps }
}
