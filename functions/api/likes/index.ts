// EdgeOne Pages Function: Photo Likes API (KV-backed)
// KV variable name: PHOTO_KV
// Key schema: likes_{photoId} → count, liked_{vid}_{photoId} → "1"

interface Env {
  PHOTO_KV: {
    get: (key: string, type?: string) => Promise<string | object | null>
    put: (key: string, value: string) => Promise<void>
    delete: (key: string) => Promise<void>
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

export async function onRequest({ request, env }: { request: Request; params: Record<string, string>; env: Env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const kv = env.PHOTO_KV
  if (!kv) {
    return json({ error: 'KV not bound' }, 500)
  }

  const url = new URL(request.url)

  // GET /api/likes?photoId=xxx&vid=yyy
  if (request.method === 'GET') {
    const photoId = url.searchParams.get('photoId')
    const vid = url.searchParams.get('vid')
    if (!photoId) {
      return json({ error: 'photoId required' }, 400)
    }

    const countStr = await kv.get(`likes_${photoId}`)
    const count = Number(countStr) || 0

    let liked = false
    if (vid) {
      const likedStr = await kv.get(`liked_${vid}_${photoId}`)
      liked = likedStr === '1'
    }

    return json({ count, liked })
  }

  // POST /api/likes { photoId, vid }
  if (request.method === 'POST') {
    let body: { photoId?: string; vid?: string }
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Invalid JSON' }, 400)
    }

    const { photoId, vid } = body
    if (!photoId || !vid) {
      return json({ error: 'photoId and vid required' }, 400)
    }

    const likeKey = `likes_${photoId}`
    const likedKey = `liked_${vid}_${photoId}`

    const countStr = await kv.get(likeKey)
    const currentCount = Number(countStr) || 0
    const likedStr = await kv.get(likedKey)
    const wasLiked = likedStr === '1'

    let newCount: number
    let nowLiked: boolean

    if (wasLiked) {
      // Unlike
      newCount = Math.max(0, currentCount - 1)
      nowLiked = false
      await kv.delete(likedKey)
    } else {
      // Like
      newCount = currentCount + 1
      nowLiked = true
      await kv.put(likedKey, '1')
    }

    await kv.put(likeKey, String(newCount))

    return json({ count: newCount, liked: nowLiked })
  }

  return json({ error: 'Method not allowed' }, 405)
}
