type KvValue = string | object | null

interface PhotoKvBinding {
  get?: (key: string, type?: string) => Promise<KvValue>
}

interface PhotoKvContext {
  env?: Record<string, unknown>
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

function envValue(name: string, context?: PhotoKvContext): string {
  const fromContext = context?.env?.[name]
  if (fromContext !== undefined && fromContext !== null && String(fromContext) !== '') {
    return String(fromContext)
  }

  const fromProcess = typeof process !== 'undefined' ? process.env?.[name] : undefined
  if (fromProcess !== undefined && fromProcess !== null && String(fromProcess) !== '') {
    return String(fromProcess)
  }

  return ''
}

function resolvePhotoKv(context?: PhotoKvContext): PhotoKvBinding | null {
  const bindingName = envValue('PHOTO_KV_BINDING', context) || 'PHOTO_KV'
  const runtimeBinding = context?.env?.[bindingName] as PhotoKvBinding | undefined
  const globalBinding = (globalThis as Record<string, unknown>)[bindingName] as PhotoKvBinding | undefined
  const kv = runtimeBinding || globalBinding

  if (!kv || typeof kv.get !== 'function') {
    return null
  }

  return kv
}

function kvDiagnostics(context?: PhotoKvContext) {
  const bindingName = envValue('PHOTO_KV_BINDING', context) || 'PHOTO_KV'
  const runtimeBinding = context?.env?.[bindingName] as PhotoKvBinding | undefined
  const globalBinding = (globalThis as Record<string, unknown>)[bindingName] as PhotoKvBinding | undefined
  const kv = runtimeBinding || globalBinding

  return {
    runtime: 'cloud-functions',
    bindingName,
    hasEnv: !!context?.env,
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

export default async function onRequest(context: { request: Request; env?: Record<string, unknown> }) {
  const { request } = context

  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405)
    }

    const kv = resolvePhotoKv(context)
    if (!kv) {
      return json({ error: 'KV not bound', ...kvDiagnostics(context) }, 500)
    }

    const url = new URL(request.url)
    const refKey = url.searchParams.get('refKey')?.trim()
    if (!refKey) {
      return json({ error: 'refKey required' }, 400)
    }

    const raw = await kv.get(`stats_${refKey}`)
    const reactions = parseReactions(raw)

    return json({
      ok: true,
      data: {
        reactions,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ error: 'Failed to load reactions', message }, 500)
  }
}
