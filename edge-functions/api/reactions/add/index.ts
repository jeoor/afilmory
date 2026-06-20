import { applyReaction, getReactions, isValidReaction, isValidRefKey, setReactions } from '../repository'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }

    let body: { action?: string, refKey?: string, reaction?: string }
    try {
      body = await request.json()
    }
    catch {
      return json({ error: 'Invalid JSON' }, 400)
    }

    const refKey = typeof body.refKey === 'string' ? body.refKey.trim() : ''
    const reaction = typeof body.reaction === 'string' ? body.reaction.trim() : ''
    const action = body.action === 'remove' ? 'remove' : 'add'

    if (!isValidRefKey(refKey) || !isValidReaction(reaction)) {
      return json({ error: 'Valid refKey and reaction required' }, 400)
    }

    const reactions = applyReaction(await getReactions(refKey), reaction, action)
    await setReactions(refKey, reactions)

    return json({
      ok: true,
      data: {
        view: 0,
        reactions,
      },
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ error: 'Failed to save reaction', message }, 500)
  }
}
