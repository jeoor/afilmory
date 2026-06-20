import { getReactions, isValidRefKey } from './repository'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

export async function onRequest(context: { request: Request }) {
  const { request } = context

  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405)
    }

    const url = new URL(request.url)
    const refKey = url.searchParams.get('refKey')?.trim() || ''
    if (!isValidRefKey(refKey)) {
      return json({ error: 'Valid refKey required' }, 400)
    }

    const reactions = await getReactions(refKey)

    return json({
      data: {
        view: 0,
        reactions,
      },
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ error: 'Failed to load reactions', message }, 500)
  }
}
