type KvValue = string | object | null

interface PhotoKvBinding {
  get?: (key: string, type?: string) => Promise<KvValue>
}

declare const PHOTO_KV: PhotoKvBinding | undefined

interface Env {
  PHOTO_KV_BINDING?: string
  PHOTO_KV: {
    get: (key: string, type?: string) => Promise<KvValue>
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function envValue(name: string, env: Partial<Env> | undefined): string {
  const value = env?.[name as keyof Env]

  if (value !== undefined && value !== null && String(value) !== '') {
    return String(value)
  }

  return ''
}

function getBindingName(env: Partial<Env> | undefined) {
  return envValue('PHOTO_KV_BINDING', env) || 'PHOTO_KV'
}

function resolvePhotoKv(env: Partial<Env> | undefined): PhotoKvBinding | null {
  const bindingName = getBindingName(env)
  const directBinding = PHOTO_KV !== undefined ? PHOTO_KV : undefined
  const runtimeBinding = env?.[bindingName as keyof Env] as PhotoKvBinding | undefined
  const globalBinding = (globalThis as Record<string, unknown>)[bindingName] as PhotoKvBinding | undefined
  const kv = directBinding || runtimeBinding || globalBinding

  if (!kv || typeof kv.get !== 'function') {
    return null
  }

  return kv
}

function kvDiagnostics(env: Partial<Env> | undefined) {
  const bindingName = getBindingName(env)
  const directBinding = PHOTO_KV !== undefined ? PHOTO_KV : undefined
  const runtimeBinding = env?.[bindingName as keyof Env] as PhotoKvBinding | undefined
  const globalBinding = (globalThis as Record<string, unknown>)[bindingName] as PhotoKvBinding | undefined
  const kv = directBinding || runtimeBinding || globalBinding

  return {
    bindingName,
    hasEnv: !!env,
    hasDirectBinding: !!directBinding,
    hasRuntimeBinding: !!runtimeBinding,
    hasGlobalBinding: !!globalBinding,
    hasPhotoKv: !!kv,
    hasGet: typeof kv?.get === 'function',
  }
}

function parseReactions(raw: KvValue): Record<string, number> {
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

export async function onRequest(context: { request: Request; env: Env }) {
  const { request } = context

  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405)
    }

    const kv = resolvePhotoKv(context.env)
    if (!kv) {
      return json({ error: 'KV not bound', ...kvDiagnostics(context.env), runtime: 'edge-functions' }, 500)
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
