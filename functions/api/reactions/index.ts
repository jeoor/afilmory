interface Env {
  PHOTO_KV: {
    get: (key: string, type?: string) => Promise<string | object | null>
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  if (!kv || typeof kv.get !== 'function') {
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

    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405)
    }

    const kv = getKv(env)
    if (!kv) {
      return json({ error: 'KV not bound' }, 500)
    }

    const url = new URL(request.url)
    const refKey = url.searchParams.get('refKey')?.trim()
    if (!refKey) {
      return json({ error: 'refKey required' }, 400)
    }

    const reactions = parseReactions(await kv.get(`stats_${refKey}`))

    return json({
      data: {
        view: 0,
        reactions,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ error: 'Failed to load reactions', message }, 500)
  }
}
