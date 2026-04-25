interface Env {
  PHOTO_KV: {
    get: (key: string, type?: string) => Promise<string | object | null>
    put: (key: string, value: string) => Promise<void>
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function getKv(env: Partial<Env> | undefined) {
  const kv = env?.PHOTO_KV

  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
    return null
  }

  return kv
}

function parseReactions(raw: string | object | null): Record<string, number> {
  if (!raw) {
    return {}
  }

  try {
    const parsed =
      typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>)
    const candidate =
      parsed && typeof parsed.reactions === 'object' && parsed.reactions
        ? (parsed.reactions as Record<string, unknown>)
        : parsed
    return Object.fromEntries(
      Object.entries(candidate)
        .map(([name, count]) => [name, Math.max(0, Number(count) || 0)] as const)
        .filter(([, count]) => count > 0),
    )
  } catch {
    return {}
  }
}

export async function onRequest({ request, env }: { request: Request; env: Env }) {
  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }

    const kv = getKv(env)
    if (!kv) {
      return json({ error: 'KV not bound' }, 500)
    }

    let body: { action?: string; refKey?: string; reaction?: string }
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }

    const refKey = typeof body.refKey === 'string' ? body.refKey.trim() : ''
    const reaction = typeof body.reaction === 'string' ? body.reaction.trim() : ''
    const action = body.action === 'remove' ? 'remove' : 'add'

    if (!refKey || !reaction) {
      return json({ error: 'refKey and reaction required' }, 400)
    }

    const statsKey = `stats_${refKey}`
    const reactions = parseReactions(await kv.get(statsKey))

    const next = Math.max(0, (reactions[reaction] || 0) + (action === 'remove' ? -1 : 1))
    if (next > 0) {
      reactions[reaction] = next
    } else {
      delete reactions[reaction]
    }
    const serialized = JSON.stringify({ reactions })
    await kv.put(statsKey, serialized)

    return json({
      ok: true,
      data: {
        view: 0,
        reactions,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ error: 'Failed to save reaction', message }, 500)
  }
}
